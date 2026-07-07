use std::collections::{HashMap, HashSet};
use std::sync::Arc;
use std::time::Duration;

use chrono::Utc;
use rand::seq::SliceRandom;
use tokio::sync::{mpsc, oneshot};
use tracing::{error, info};

use sb_contracts::tournament_api::{
    TournamentConfig, TournamentResult, TournamentStatus, TournamentType,
};
use sb_shared_types::{AppError, ChipAmount, PlayerId, TableConfig, TableId, TournamentId, UserId};
use sb_table_registry::actor::InternalCommand as TableCommand;
use sb_table_registry::connection_broker::ConnectionBroker;
use sb_table_registry::events::{HandCompletedEvent, TableEvent};
use sb_table_registry::registry::Registry;

use crate::blind_scheduler::BlindScheduler;
use crate::payout_calculator::calculate_payouts;

pub enum SitGoCommand {
    Register {
        user_id: UserId,
        respond_to: oneshot::Sender<Result<(), AppError>>,
    },
    Unregister {
        user_id: UserId,
        respond_to: oneshot::Sender<Result<(), AppError>>,
    },
    GetSummary {
        respond_to: oneshot::Sender<sb_contracts::tournament_api::TournamentSummary>,
    },
    GetResults {
        respond_to: oneshot::Sender<Vec<TournamentResult>>,
    },
    SetRepoHandle {
        repo: Arc<dyn sb_contracts::tournament_api::TournamentRepo>,
        user_repo: Arc<dyn sb_contracts::repo_api::UserRepo>,
    },
    GetMyTable {
        user_id: UserId,
        respond_to: oneshot::Sender<Option<TableId>>,
    },
}

#[derive(Clone)]
struct RegisteredPlayer {
    user_id: UserId,
    player_id: PlayerId,
    buy_in: ChipAmount,
}

pub struct SitGoTournament {
    tournament_id: TournamentId,
    config: TournamentConfig,
    status: TournamentStatus,
    players: Vec<RegisteredPlayer>,
    prize_pool: ChipAmount,
    results: Vec<TournamentResult>,
    started_at: Option<chrono::DateTime<chrono::Utc>>,

    registry: Arc<Registry>,
    broker: Arc<ConnectionBroker>,
    cmd_rx: mpsc::Receiver<SitGoCommand>,
    event_rx: tokio::sync::broadcast::Receiver<TableEvent>,
    table_cmd_tx: Option<mpsc::Sender<TableCommand>>,
    blind_scheduler: Option<BlindScheduler>,
    players_remaining: u32,

    survivors: HashSet<UserId>,
    elimination_order: Vec<(UserId, PlayerId)>,
    player_info: HashMap<UserId, PlayerId>,

    tournament_repo: Option<Arc<dyn sb_contracts::tournament_api::TournamentRepo>>,
    user_repo: Option<Arc<dyn sb_contracts::repo_api::UserRepo>>,
    pending_start: bool,

    table_id: Option<TableId>,
    user_to_table: HashMap<UserId, TableId>,

    created_by: UserId,
    chat_id: Option<String>,

    // NEW: completion signal
    completion_tx: Option<oneshot::Sender<()>>,
}

impl SitGoTournament {
    #[allow(clippy::too_many_arguments)]
    pub fn new(
        tournament_id: TournamentId,
        config: TournamentConfig,
        registry: Arc<Registry>,
        broker: Arc<ConnectionBroker>,
        cmd_rx: mpsc::Receiver<SitGoCommand>,
        event_rx: tokio::sync::broadcast::Receiver<TableEvent>,
        created_by: UserId,
        chat_id: Option<String>,
        completion_tx: Option<oneshot::Sender<()>>,
    ) -> Self {
        Self {
            tournament_id,
            config,
            status: TournamentStatus::Registering,
            players: Vec::new(),
            prize_pool: ChipAmount::new(0).unwrap(),
            results: Vec::new(),
            started_at: None,
            registry,
            broker,
            cmd_rx,
            event_rx,
            table_cmd_tx: None,
            blind_scheduler: None,
            players_remaining: 0,
            survivors: HashSet::new(),
            elimination_order: Vec::new(),
            player_info: HashMap::new(),
            tournament_repo: None,
            user_repo: None,
            pending_start: false,
            table_id: None,
            user_to_table: HashMap::new(),
            created_by,
            chat_id,
            completion_tx,
        }
    }

    pub async fn run(mut self) {
        info!(tournament_id = %self.tournament_id, "SitGoTournament started");
        loop {
            if self.pending_start {
                self.pending_start = false;
                if let Err(e) = self.start_tournament().await {
                    error!(tournament_id = %self.tournament_id, error = ?e, "Failed to start tournament");
                }
            }
            tokio::select! {
                Some(cmd) = self.cmd_rx.recv() => {
                    self.handle_command(cmd).await;
                }
                Ok(event) = self.event_rx.recv() => {
                    if let TableEvent::HandCompleted(hand_event) = event {
                        self.handle_hand_completed(hand_event).await;
                    }
                }
                else => break,
            }
        }
        info!(tournament_id = %self.tournament_id, "SitGoTournament terminated");
    }

    pub(crate) async fn handle_command(&mut self, cmd: SitGoCommand) {
        match cmd {
            SitGoCommand::Register {
                user_id,
                respond_to,
            } => {
                let result = self.register_player(user_id).await;
                let _ = respond_to.send(result);
            }
            SitGoCommand::Unregister {
                user_id,
                respond_to,
            } => {
                let result = self.unregister_player(user_id).await;
                let _ = respond_to.send(result);
            }
            SitGoCommand::GetSummary { respond_to } => {
                let summary = self.build_summary();
                let _ = respond_to.send(summary);
            }
            SitGoCommand::GetResults { respond_to } => {
                let _ = respond_to.send(self.results.clone());
            }
            SitGoCommand::SetRepoHandle { repo, user_repo } => {
                self.tournament_repo = Some(repo);
                self.user_repo = Some(user_repo);
            }
            SitGoCommand::GetMyTable {
                user_id,
                respond_to,
            } => {
                let table_id = self.user_to_table.get(&user_id).copied();
                let _ = respond_to.send(table_id);
            }
        }
    }

    async fn register_player(&mut self, user_id: UserId) -> Result<(), AppError> {
        if self.status != TournamentStatus::Registering {
            return Err(AppError::TournamentRegistrationClosed);
        }
        if self.players.len() as u32 >= self.config.max_players {
            return Err(AppError::TournamentFull);
        }
        if self.players.iter().any(|p| p.user_id == user_id) {
            return Err(AppError::Conflict("Already registered".into()));
        }

        let buy_in = self.config.buy_in;
        let player_id = PlayerId::new(user_id.as_uuid());
        self.players.push(RegisteredPlayer {
            user_id,
            player_id,
            buy_in,
        });
        self.player_info.insert(user_id, player_id);
        self.prize_pool = ChipAmount::new(self.prize_pool.as_i64() + buy_in.as_i64()).unwrap();

        self.broker
            .subscribe_to_room(TableId::new(self.tournament_id.as_uuid()), user_id);

        let msg = sb_table_registry::game_room::RoomMessage::TournamentRegistered {
            tournament_id: self.tournament_id,
            user_id,
        };
        self.broker
            .broadcast_to_room(TableId::new(self.tournament_id.as_uuid()), msg);

        info!(
            tournament_id = %self.tournament_id,
            %user_id,
            registered_count = self.players.len(),
            "Player registered"
        );

        self.broadcast_state();

        if self.players.len() as u32 >= self.config.max_players {
            self.pending_start = true;
        }

        Ok(())
    }

    async fn unregister_player(&mut self, user_id: UserId) -> Result<(), AppError> {
        if self.status != TournamentStatus::Registering {
            return Err(AppError::TournamentRegistrationClosed);
        }
        let idx = self
            .players
            .iter()
            .position(|p| p.user_id == user_id)
            .ok_or(AppError::NotFound("Player not registered".into()))?;
        let player = self.players.remove(idx);
        self.prize_pool = ChipAmount::new(self.prize_pool.as_i64() - player.buy_in.as_i64())
            .unwrap_or_else(|| ChipAmount::new(0).unwrap());
        self.player_info.remove(&user_id);
        self.broker
            .unsubscribe_from_room(TableId::new(self.tournament_id.as_uuid()), user_id);
        self.broadcast_state();
        Ok(())
    }

    async fn start_tournament(&mut self) -> Result<(), AppError> {
        info!(tournament_id = %self.tournament_id, "Starting tournament");

        let delay = self.config.start_delay_seconds;
        tokio::time::sleep(Duration::from_secs(delay as u64)).await;

        self.status = TournamentStatus::Running;
        self.started_at = Some(Utc::now());

        let msg = sb_table_registry::game_room::RoomMessage::TournamentStarting {
            tournament_id: self.tournament_id,
            starts_in_seconds: 0,
        };
        self.broker
            .broadcast_to_room(TableId::new(self.tournament_id.as_uuid()), msg);

        if let Some(repo) = &self.tournament_repo {
            let _ = repo
                .set_status(
                    self.tournament_id,
                    TournamentStatus::Running,
                    self.started_at,
                )
                .await;
        }

        let shuffled = {
            let mut rng = rand::rng();
            let mut tmp = self.players.clone();
            tmp.shuffle(&mut rng);
            tmp
        };

        let table_config = TableConfig {
            max_players: self.config.max_players as u8,
            stake_level: sb_shared_types::StakeLevel::Micro,
            variant: sb_shared_types::GameVariant::Holdem,
            min_buy_in: self.config.buy_in,
            max_buy_in: self.config.buy_in,
            turn_time_limit_ms: 30_000,
        };

        let (cmd_tx, table_id) = self
            .registry
            .create_tournament_table(
                table_config,
                self.tournament_id,
                self.broker.clone(),
                self.created_by,
                self.chat_id.clone(),
            )
            .await?;

        self.table_id = Some(table_id);
        self.table_cmd_tx = Some(cmd_tx.clone());

        for (seat, player) in shuffled.iter().enumerate() {
            let (tx, rx) = oneshot::channel();
            let cmd = TableCommand::TransferPlayerIn {
                user_id: player.user_id,
                player_id: player.player_id,
                stack: player.buy_in,
                seat: Some(seat as u8),
                respond_to: tx,
            };
            cmd_tx
                .send(cmd)
                .await
                .map_err(|_| AppError::Internal("table actor dropped".into()))?;
            match rx.await {
                Ok(Ok(assigned_seat)) => {
                    let msg = sb_table_registry::game_room::RoomMessage::TournamentTableChanged {
                        tournament_id: self.tournament_id,
                        new_room_id: TableId::new(self.tournament_id.as_uuid()),
                        new_seat: assigned_seat,
                    };
                    self.broker.send_to_user(player.user_id, msg);
                    self.user_to_table.insert(player.user_id, table_id);
                }
                Ok(Err(e)) => {
                    error!(%player.user_id, error = ?e, "Failed to transfer player");
                    return Err(e);
                }
                Err(_) => {
                    return Err(AppError::Internal("actor dropped".into()));
                }
            }
        }

        self.players_remaining = shuffled.len() as u32;
        self.survivors = shuffled.iter().map(|p| p.user_id).collect();

        let mut scheduler = BlindScheduler::new(self.config.blind_schedule.levels.clone());
        let (sb, bb, _ante) = scheduler.current_blinds();
        let _ = cmd_tx
            .send(TableCommand::SetBlinds { small: sb, big: bb })
            .await;
        scheduler.start_timer();
        self.blind_scheduler = Some(scheduler);

        let (tx, rx) = oneshot::channel();
        let _ = cmd_tx
            .send(TableCommand::ResumeHand {
                force_dealer_seat: None,
                respond_to: tx,
            })
            .await;
        let _ = rx.await;

        self.broadcast_state();
        info!(tournament_id = %self.tournament_id, "Tournament running");
        Ok(())
    }

    pub(crate) async fn handle_hand_completed(&mut self, event: HandCompletedEvent) {
        if self.status != TournamentStatus::Running {
            return;
        }

        for (user_id, _starting_stack) in &event.busted_players {
            if self.survivors.contains(user_id) {
                let position = self.players_remaining;
                self.players_remaining -= 1;
                self.survivors.remove(user_id);

                let player_id = self
                    .player_info
                    .get(user_id)
                    .copied()
                    .unwrap_or_else(|| PlayerId::new(user_id.as_uuid()));
                self.elimination_order.push((*user_id, player_id));

                let msg = sb_table_registry::game_room::RoomMessage::TournamentElimination {
                    tournament_id: self.tournament_id,
                    user_id: *user_id,
                    position,
                };
                self.broker
                    .broadcast_to_room(TableId::new(self.tournament_id.as_uuid()), msg);

                info!(
                    tournament_id = %self.tournament_id,
                    %user_id,
                    position,
                    "Player eliminated"
                );
            }
        }

        if self.players_remaining <= 1 {
            self.end_tournament().await;
            return;
        }

        if let Some(scheduler) = &mut self.blind_scheduler {
            if let Some((level, sb, bb, ante)) = scheduler.on_hand_completed() {
                if let Some(cmd_tx) = &self.table_cmd_tx {
                    let _ = cmd_tx
                        .send(TableCommand::SetBlinds { small: sb, big: bb })
                        .await;
                }
                let msg = sb_table_registry::game_room::RoomMessage::TournamentBlindLevel {
                    tournament_id: self.tournament_id,
                    level,
                    small_blind: sb.as_i64(),
                    big_blind: bb.as_i64(),
                    ante,
                };
                self.broker
                    .broadcast_to_room(TableId::new(self.tournament_id.as_uuid()), msg);
            }
        }

        if let Some(cmd_tx) = &self.table_cmd_tx {
            let (tx, rx) = oneshot::channel();
            let _ = cmd_tx
                .send(TableCommand::ResumeHand {
                    force_dealer_seat: None,
                    respond_to: tx,
                })
                .await;
            let _ = rx.await;
        }

        self.broadcast_state();
    }

    async fn end_tournament(&mut self) {
        self.status = TournamentStatus::Completed;
        let completed_at = Utc::now();

        let survivor_user = self.survivors.iter().copied().next();
        let total_players = self.config.max_players;

        let mut position_map: HashMap<u32, UserId> = HashMap::new();
        for (i, (user_id, _)) in self.elimination_order.iter().enumerate() {
            let position = total_players - i as u32;
            position_map.insert(position, *user_id);
        }
        if let Some(user_id) = survivor_user {
            position_map.insert(1, user_id);
        }

        let prize_pool = self.prize_pool.as_i64();
        let payouts = calculate_payouts(prize_pool, &self.config.payout_structure);

        for (position, prize_amount) in &payouts {
            if let Some(user_id) = position_map.get(position) {
                let prize = ChipAmount::new(*prize_amount).unwrap();
                self.results.push(TournamentResult {
                    tournament_id: self.tournament_id,
                    user_id: *user_id,
                    position: *position,
                    prize,
                    completed_at,
                });

                if let Some(user_repo) = &self.user_repo {
                    let ctx =
                        sb_shared_types::RequestContext::new(uuid::Uuid::new_v4(), Some(*user_id));
                    if let Err(e) = user_repo
                        .update_chip_balance(ctx, *user_id, prize.as_i64())
                        .await
                    {
                        error!(%user_id, error = ?e, "Failed to credit tournament prize");
                    }
                }

                if let Some(repo) = &self.tournament_repo {
                    let _ = repo
                        .record_result(&TournamentResult {
                            tournament_id: self.tournament_id,
                            user_id: *user_id,
                            position: *position,
                            prize,
                            completed_at,
                        })
                        .await;
                }
            }
        }

        let msg = sb_table_registry::game_room::RoomMessage::TournamentResult {
            tournament_id: self.tournament_id,
            results: self
                .results
                .iter()
                .map(|r| sb_table_registry::game_room::TournamentResultPayload {
                    tournament_id: r.tournament_id,
                    user_id: r.user_id,
                    position: r.position,
                    prize: r.prize.as_i64() as u64,
                })
                .collect(),
        };
        self.broker
            .broadcast_to_room(TableId::new(self.tournament_id.as_uuid()), msg);

        if let Some(repo) = &self.tournament_repo {
            let _ = repo
                .set_status(
                    self.tournament_id,
                    TournamentStatus::Completed,
                    Some(completed_at),
                )
                .await;
        }

        if let Some(cmd_tx) = &self.table_cmd_tx {
            let _ = cmd_tx.send(TableCommand::Shutdown).await;
        }

        // Signal completion to the service
        if let Some(tx) = self.completion_tx.take() {
            let _ = tx.send(());
        }

        info!(tournament_id = %self.tournament_id, "Tournament completed");
        self.broadcast_state();
    }

    fn broadcast_state(&self) {
        let msg = sb_table_registry::game_room::RoomMessage::TournamentState(
            sb_table_registry::game_room::TournamentStateUpdate {
                tournament_id: self.tournament_id,
                status: format!("{:?}", self.status),
                registered_count: self.players.len() as u32,
                max_players: self.config.max_players,
                prize_pool: self.prize_pool.as_i64() as u64,
                blind_level: self.blind_scheduler.as_ref().map(|s| s.current_level().0),
            },
        );
        self.broker
            .broadcast_to_room(TableId::new(self.tournament_id.as_uuid()), msg);
    }

    fn build_summary(&self) -> sb_contracts::tournament_api::TournamentSummary {
        sb_contracts::tournament_api::TournamentSummary {
            id: self.tournament_id,
            tournament_type: TournamentType::SitAndGo,
            status: self.status,
            registered: self.players.len() as u32,
            max_players: self.config.max_players,
            buy_in: self.config.buy_in,
            prize_pool: self.prize_pool,
            current_blind_level: self.blind_scheduler.as_ref().map(|s| s.current_level().0),
            started_at: self.started_at,
        }
    }
}

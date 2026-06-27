use std::collections::{HashMap, HashSet};
use std::sync::Arc;
use std::time::Duration;

use chrono::Utc;
use rand::prelude::*; // imports Rng, SliceRandom, etc.
use tokio::sync::{mpsc, oneshot};
use tracing::info;

use sb_contracts::tournament_api::{
    TournamentConfig, TournamentResult, TournamentStatus, TournamentType,
};
use sb_shared_types::{AppError, ChipAmount, PlayerId, TableConfig, TableId, TournamentId, UserId};
use sb_table_registry::actor::InternalCommand as TableCommand;
use sb_table_registry::connection_broker::ConnectionBroker;
use sb_table_registry::events::HandCompletedEvent;
use sb_table_registry::registry::Registry;

use crate::blind_scheduler::BlindScheduler;
use crate::payout_calculator::calculate_payouts;
use crate::rebalancer::{compute_final_table_moves, compute_rebalance_moves};

pub enum MttCommand {
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

struct TableInfo {
    table_id: TableId,
    cmd_tx: mpsc::Sender<TableCommand>,
    players: Vec<(PlayerId, UserId)>,
}

enum DirectorState {
    Registering,
    Running,
    Pausing,
    Rebalancing,
    Completed,
}

pub struct MttDirector {
    tournament_id: TournamentId,
    config: TournamentConfig,
    state: DirectorState,
    players: Vec<RegisteredPlayer>,
    prize_pool: ChipAmount,
    results: Vec<TournamentResult>,
    started_at: Option<chrono::DateTime<chrono::Utc>>,

    registry: Arc<Registry>,
    broker: Arc<ConnectionBroker>,
    cmd_rx: mpsc::Receiver<MttCommand>,
    event_rx: tokio::sync::broadcast::Receiver<HandCompletedEvent>,

    tables: Vec<TableInfo>,
    blind_scheduler: Option<BlindScheduler>,
    player_assignments: HashMap<UserId, usize>,

    survivors: HashSet<UserId>,
    elimination_order: Vec<(UserId, PlayerId)>,
    player_info: HashMap<UserId, PlayerId>,

    tournament_repo: Option<Arc<dyn sb_contracts::tournament_api::TournamentRepo>>,
    user_repo: Option<Arc<dyn sb_contracts::repo_api::UserRepo>>,

    user_to_table: HashMap<UserId, TableId>,
}

impl MttDirector {
    #[allow(clippy::too_many_arguments)]
    pub fn new(
        tournament_id: TournamentId,
        config: TournamentConfig,
        registry: Arc<Registry>,
        broker: Arc<ConnectionBroker>,
        cmd_rx: mpsc::Receiver<MttCommand>,
        event_rx: tokio::sync::broadcast::Receiver<HandCompletedEvent>,
    ) -> Self {
        Self {
            tournament_id,
            config,
            state: DirectorState::Registering,
            players: Vec::new(),
            prize_pool: ChipAmount::new(0).unwrap(),
            results: Vec::new(),
            started_at: None,
            registry,
            broker,
            cmd_rx,
            event_rx,
            tables: Vec::new(),
            blind_scheduler: None,
            player_assignments: HashMap::new(),
            survivors: HashSet::new(),
            elimination_order: Vec::new(),
            player_info: HashMap::new(),
            tournament_repo: None,
            user_repo: None,
            user_to_table: HashMap::new(),
        }
    }

    pub async fn run(mut self) {
        info!(tournament_id = %self.tournament_id, "MttDirector started");
        loop {
            tokio::select! {
                Some(cmd) = self.cmd_rx.recv() => {
                    self.handle_command(cmd).await;
                }
                Ok(event) = self.event_rx.recv() => {
                    self.handle_hand_completed(event).await;
                }
                else => break,
            }
        }
        info!(tournament_id = %self.tournament_id, "MttDirector terminated");
    }

    // ─── Helper to fetch actual stacks from table actor ──────────────
    async fn fetch_player_stacks(&self, table_idx: usize) -> Vec<(PlayerId, UserId, ChipAmount)> {
        let table = &self.tables[table_idx];
        let mut result = Vec::new();
        for (player_id, user_id) in &table.players {
            let (tx, rx) = tokio::sync::oneshot::channel();
            let cmd = TableCommand::GetPlayerStack {
                user_id: *user_id,
                respond_to: tx,
            };
            if let Err(e) = table.cmd_tx.send(cmd).await {
                tracing::error!(%user_id, error = ?e, "Failed to get player stack");
                continue;
            }
            if let Ok(stack) = rx.await {
                result.push((*player_id, *user_id, stack));
            }
        }
        result
    }

    pub(crate) async fn handle_command(&mut self, cmd: MttCommand) {
        match cmd {
            MttCommand::Register {
                user_id,
                respond_to,
            } => {
                let result = self.register_player(user_id).await;
                let _ = respond_to.send(result);
            }
            MttCommand::Unregister {
                user_id,
                respond_to,
            } => {
                let result = self.unregister_player(user_id).await;
                let _ = respond_to.send(result);
            }
            MttCommand::GetSummary { respond_to } => {
                let _ = respond_to.send(self.build_summary());
            }
            MttCommand::GetResults { respond_to } => {
                let _ = respond_to.send(self.results.clone());
            }
            MttCommand::SetRepoHandle { repo, user_repo } => {
                self.tournament_repo = Some(repo);
                self.user_repo = Some(user_repo);
            }
            MttCommand::GetMyTable {
                user_id,
                respond_to,
            } => {
                let table_id = self.user_to_table.get(&user_id).copied();
                let _ = respond_to.send(table_id);
            }
        }
    }

    async fn register_player(&mut self, user_id: UserId) -> Result<(), AppError> {
        if !matches!(self.state, DirectorState::Registering) {
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

        if let Some(repo) = &self.tournament_repo {
            repo.register_player(self.tournament_id, user_id, buy_in)
                .await?;
        }

        self.broker
            .subscribe_to_room(TableId::new(self.tournament_id.as_uuid()), user_id);

        let msg = sb_table_registry::game_room::RoomMessage::TournamentRegistered {
            tournament_id: self.tournament_id,
            user_id,
        };
        self.broker
            .broadcast_to_room(TableId::new(self.tournament_id.as_uuid()), msg);

        info!(tournament_id = %self.tournament_id, %user_id, registered = self.players.len(), "MTT registration");

        self.broadcast_state();

        if self.players.len() as u32 >= self.config.min_players_to_start {
            self.start_tournament().await?;
        }

        Ok(())
    }

    async fn unregister_player(&mut self, user_id: UserId) -> Result<(), AppError> {
        if !matches!(self.state, DirectorState::Registering) {
            return Err(AppError::TournamentRegistrationClosed);
        }
        let idx = self
            .players
            .iter()
            .position(|p| p.user_id == user_id)
            .ok_or(AppError::NotFound("Not registered".into()))?;
        let player = self.players.remove(idx);
        self.prize_pool =
            ChipAmount::new((self.prize_pool.as_i64() - player.buy_in.as_i64()).max(0)).unwrap();
        self.player_info.remove(&user_id);

        if let Some(repo) = &self.tournament_repo {
            repo.unregister_player(self.tournament_id, user_id, self.config.buy_in)
                .await?;
        }

        self.broker
            .unsubscribe_from_room(TableId::new(self.tournament_id.as_uuid()), user_id);
        self.broadcast_state();
        Ok(())
    }

    async fn start_tournament(&mut self) -> Result<(), AppError> {
        info!(tournament_id = %self.tournament_id, "Starting MTT");

        let delay = self.config.start_delay_seconds;
        tokio::time::sleep(Duration::from_secs(delay as u64)).await;

        self.state = DirectorState::Running;
        self.started_at = Some(Utc::now());

        let msg = sb_table_registry::game_room::RoomMessage::TournamentStarting {
            tournament_id: self.tournament_id,
            starts_in_seconds: 0,
        };
        self.broker
            .broadcast_to_room(TableId::new(self.tournament_id.as_uuid()), msg);

        let shuffled = {
            let mut rng = rand::rng();
            let mut tmp = self.players.clone();
            tmp.shuffle(&mut rng);
            tmp
        };

        let num_tables = (shuffled.len() as f32 / 9.0).ceil() as usize;
        let table_config = TableConfig {
            max_players: 9,
            stake_level: sb_shared_types::StakeLevel::Micro,
            variant: sb_shared_types::GameVariant::Holdem,
            min_buy_in: self.config.buy_in,
            max_buy_in: self.config.buy_in,
            turn_time_limit_ms: 30_000,
        };

        for _ in 0..num_tables {
            let (cmd_tx, table_id) = self
                .registry
                .create_tournament_table(
                    table_config.clone(),
                    self.tournament_id,
                    self.broker.clone(),
                )
                .await?;
            self.tables.push(TableInfo {
                table_id,
                cmd_tx,
                players: vec![],
            });
        }

        for (i, player) in shuffled.iter().enumerate() {
            let table_idx = i % num_tables;
            let table = &mut self.tables[table_idx];
            let seat = table.players.len() as u8;

            let (tx, rx) = oneshot::channel();
            let cmd = TableCommand::TransferPlayerIn {
                user_id: player.user_id,
                player_id: player.player_id,
                stack: player.buy_in,
                seat: Some(seat),
                respond_to: tx,
            };
            table
                .cmd_tx
                .send(cmd)
                .await
                .map_err(|_| AppError::Internal("actor dropped".into()))?;
            let assigned_seat = rx
                .await
                .map_err(|_| AppError::Internal("response dropped".into()))?
                .map_err(|e| AppError::Internal(format!("{:?}", e)))?;

            table.players.push((player.player_id, player.user_id));
            self.player_assignments.insert(player.user_id, table_idx);
            self.survivors.insert(player.user_id);
            self.user_to_table.insert(player.user_id, table.table_id);

            let msg = sb_table_registry::game_room::RoomMessage::TournamentTableChanged {
                tournament_id: self.tournament_id,
                new_room_id: TableId::new(self.tournament_id.as_uuid()),
                new_seat: assigned_seat,
            };
            self.broker.send_to_user(player.user_id, msg);
        }

        let mut scheduler = BlindScheduler::new(self.config.blind_schedule.levels.clone());
        let (sb, bb, _) = scheduler.current_blinds();
        for table in &self.tables {
            let _ = table
                .cmd_tx
                .send(TableCommand::SetBlinds { small: sb, big: bb })
                .await;
        }
        scheduler.start_timer();
        self.blind_scheduler = Some(scheduler);

        for table in &self.tables {
            let (tx, rx) = oneshot::channel();
            let _ = table
                .cmd_tx
                .send(TableCommand::ResumeHand {
                    force_dealer_seat: None,
                    respond_to: tx,
                })
                .await;
            let _ = rx.await;
        }

        self.broadcast_state();
        info!(tournament_id = %self.tournament_id, tables = num_tables, "MTT running");
        Ok(())
    }

    pub(crate) async fn handle_hand_completed(&mut self, event: HandCompletedEvent) {
        if !matches!(self.state, DirectorState::Running) {
            return;
        }

        for (user_id, _) in &event.busted_players {
            if self.survivors.contains(user_id) {
                let position = self.survivors.len() as u32;
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
                info!(tournament_id = %self.tournament_id, %user_id, position, "MTT elimination");
            }
        }

        let total_active = self.survivors.len();
        if total_active <= 1 {
            self.end_tournament().await;
            return;
        }

        if total_active <= 9 && self.tables.len() > 1 {
            self.do_final_table_merge().await;
        } else {
            let needs_rebalance = self.tables.iter().any(|t| t.players.len() <= 2);
            if needs_rebalance && total_active > 9 {
                self.do_rebalance().await;
            }
        }

        if let Some(scheduler) = &mut self.blind_scheduler
            && let Some((level, sb, bb, ante)) = scheduler.on_hand_completed()
        {
            for table in &self.tables {
                let _ = table
                    .cmd_tx
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

        for table in &self.tables {
            let (tx, rx) = oneshot::channel();
            let _ = table
                .cmd_tx
                .send(TableCommand::ResumeHand {
                    force_dealer_seat: None,
                    respond_to: tx,
                })
                .await;
            let _ = rx.await;
        }

        self.broadcast_state();
    }

    async fn do_rebalance(&mut self) {
        self.state = DirectorState::Pausing;

        // Pause all tables
        for table in &self.tables {
            let (tx, rx) = oneshot::channel();
            let _ = table
                .cmd_tx
                .send(TableCommand::PauseHand { respond_to: tx })
                .await;
            let _ = rx.await;
        }

        // ─── Fetch actual stacks for all players ──────────────────────
        let mut table_states = Vec::with_capacity(self.tables.len());
        for idx in 0..self.tables.len() {
            let stacks = self.fetch_player_stacks(idx).await;
            table_states.push(stacks);
        }

        let moves = compute_rebalance_moves(&table_states);

        self.state = DirectorState::Rebalancing;
        info!(tournament_id = %self.tournament_id, moves = moves.len(), "Rebalancing");

        for m in &moves {
            let from_table = &self.tables[m.from_table_idx];
            let to_table = &self.tables[m.to_table_idx];

            // Transfer out
            let (tx, rx) = oneshot::channel();
            let _ = from_table
                .cmd_tx
                .send(TableCommand::TransferPlayerOut {
                    user_id: m.user_id,
                    respond_to: tx,
                })
                .await;
            let result = rx.await;
            if let Ok(transfer) = result {
                // Transfer in with the actual stack (from transfer)
                let (tx, rx) = oneshot::channel();
                let _ = to_table
                    .cmd_tx
                    .send(TableCommand::TransferPlayerIn {
                        user_id: m.user_id,
                        player_id: m.player_id,
                        stack: transfer.stack,
                        seat: None,
                        respond_to: tx,
                    })
                    .await;
                if let Ok(seat_result) = rx.await
                    && let Ok(seat) = seat_result
                {
                    let msg = sb_table_registry::game_room::RoomMessage::TournamentTableChanged {
                        tournament_id: self.tournament_id,
                        new_room_id: TableId::new(self.tournament_id.as_uuid()),
                        new_seat: seat,
                    };
                    self.broker.send_to_user(m.user_id, msg);
                    self.user_to_table.insert(m.user_id, to_table.table_id);
                }
            }
        }

        // Remove empty tables
        self.tables.retain(|t| !t.players.is_empty());

        // Resume
        for table in &self.tables {
            let (tx, rx) = oneshot::channel();
            let _ = table
                .cmd_tx
                .send(TableCommand::ResumeHand {
                    force_dealer_seat: None,
                    respond_to: tx,
                })
                .await;
            let _ = rx.await;
        }

        self.state = DirectorState::Running;
    }

    async fn do_final_table_merge(&mut self) {
        self.state = DirectorState::Pausing;

        // Pause all tables
        for table in &self.tables {
            let (tx, rx) = oneshot::channel();
            let _ = table
                .cmd_tx
                .send(TableCommand::PauseHand { respond_to: tx })
                .await;
            let _ = rx.await;
        }

        // ─── Fetch actual stacks for all players ──────────────────────
        let mut table_states = Vec::with_capacity(self.tables.len());
        for idx in 0..self.tables.len() {
            let stacks = self.fetch_player_stacks(idx).await;
            table_states.push(stacks);
        }

        let moves = compute_final_table_moves(&table_states);

        for m in &moves {
            let from_table = &self.tables[m.from_table_idx];
            let to_table = &self.tables[m.to_table_idx];

            let (tx, rx) = oneshot::channel();
            let _ = from_table
                .cmd_tx
                .send(TableCommand::TransferPlayerOut {
                    user_id: m.user_id,
                    respond_to: tx,
                })
                .await;
            if let Ok(transfer) = rx.await {
                let (tx, rx) = oneshot::channel();
                let _ = to_table
                    .cmd_tx
                    .send(TableCommand::TransferPlayerIn {
                        user_id: m.user_id,
                        player_id: m.player_id,
                        stack: transfer.stack,
                        seat: None,
                        respond_to: tx,
                    })
                    .await;
                if let Ok(seat_result) = rx.await
                    && let Ok(seat) = seat_result
                {
                    let msg = sb_table_registry::game_room::RoomMessage::TournamentTableChanged {
                        tournament_id: self.tournament_id,
                        new_room_id: TableId::new(self.tournament_id.as_uuid()),
                        new_seat: seat,
                    };
                    self.broker.send_to_user(m.user_id, msg);
                    self.user_to_table.insert(m.user_id, to_table.table_id);
                }
            }
        }

        // Keep only the final table
        self.tables.retain(|t| !t.players.is_empty());
        if self.tables.len() > 1 {
            self.tables.truncate(1);
        }

        let dealer_seat = {
            let mut rng = rand::rng();
            rng.random_range(0..9u8)
        };
        for table in &self.tables {
            let (tx, rx) = oneshot::channel();
            let _ = table
                .cmd_tx
                .send(TableCommand::ResumeHand {
                    force_dealer_seat: Some(dealer_seat),
                    respond_to: tx,
                })
                .await;
            let _ = rx.await;
        }

        self.state = DirectorState::Running;
        info!(tournament_id = %self.tournament_id, "Final table merge complete");
    }

    async fn end_tournament(&mut self) {
        self.state = DirectorState::Completed;
        let completed_at = Utc::now();

        let survivor_user = self.survivors.iter().copied().next();
        let total_players = self.config.max_players;

        let mut position_map: HashMap<u32, UserId> = HashMap::new();
        for (i, (user_id, _)) in self.elimination_order.iter().enumerate() {
            let position = total_players - i as u32;
            position_map.insert(position, *user_id);
        }
        if let Some(uid) = survivor_user {
            position_map.insert(1, uid);
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
                    let _ = user_repo
                        .update_chip_balance(ctx, *user_id, prize.as_i64())
                        .await;
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

        for table in &self.tables {
            let _ = table.cmd_tx.send(TableCommand::Shutdown).await;
        }

        info!(tournament_id = %self.tournament_id, "MTT completed");
    }

    fn broadcast_state(&self) {
        let msg = sb_table_registry::game_room::RoomMessage::TournamentState(
            sb_table_registry::game_room::TournamentStateUpdate {
                tournament_id: self.tournament_id,
                status: match self.state {
                    DirectorState::Registering => "Registering".into(),
                    _ => "Running".into(),
                },
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
            tournament_type: TournamentType::Mtt,
            status: match self.state {
                DirectorState::Registering => TournamentStatus::Registering,
                _ => TournamentStatus::Running,
            },
            registered: self.players.len() as u32,
            max_players: self.config.max_players,
            buy_in: self.config.buy_in,
            prize_pool: self.prize_pool,
            current_blind_level: self.blind_scheduler.as_ref().map(|s| s.current_level().0),
            started_at: self.started_at,
        }
    }

    /// Emit a TournamentCompletedEvent when the tournament ends.
    pub fn build_completion_event(
        &self,
        final_rankings: Vec<sb_contracts::tournament_api::TournamentRanking>,
    ) -> sb_contracts::tournament_api::TournamentCompletedEvent {
        sb_contracts::tournament_api::TournamentCompletedEvent {
            tournament_id: self.tournament_id,
            club_id: self.config.club_id,
            tournament_name: self.config.name.clone(),
            final_rankings,
        }
    }

}

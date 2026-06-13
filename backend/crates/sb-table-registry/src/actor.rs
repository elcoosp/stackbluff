#![allow(dead_code)]
#![allow(unused_imports)]
const DEFAULT_TIMER_MS: u64 = 30_000;
// Production table actor – stable PlayerId, dealer rotation,
// timeout cleanup, error propagation, full observability.

use std::collections::HashMap;
use uuid::Uuid;

use tokio::sync::mpsc;

use sb_game_engine::game_state::{Action, ActionError, GameState};
use sb_shared_types::AppError;
use sb_shared_types::{ActionType, ChipAmount, PlayerId, StakeLevel, TableConfig, TableId, UserId};
use sb_ws_handler::BroadcastSender;
use sb_ws_messages::{Card as WsCard, ServerMessage, TableStateUpdate};
use std::pin::Pin;
use tokio::time::{Duration, Sleep, sleep};
use tracing::{Instrument, Level, debug, error, info, span, warn};

fn zero() -> ChipAmount {
    ChipAmount::new(0).unwrap()
}

fn blinds_for_stake(stake: StakeLevel) -> (ChipAmount, ChipAmount) {
    match stake {
        StakeLevel::Micro => (ChipAmount::new(5).unwrap(), ChipAmount::new(10).unwrap()),
        StakeLevel::Low => (ChipAmount::new(10).unwrap(), ChipAmount::new(20).unwrap()),
        StakeLevel::Medium => (ChipAmount::new(25).unwrap(), ChipAmount::new(50).unwrap()),
        StakeLevel::High => (ChipAmount::new(50).unwrap(), ChipAmount::new(100).unwrap()),
        StakeLevel::VeryHigh => (ChipAmount::new(100).unwrap(), ChipAmount::new(200).unwrap()),
    }
}

#[derive(Debug, Clone)]
pub enum InternalCommand {
    Join {
        user_id: UserId,
        seat: u8,
        stack: ChipAmount,
    },
    Leave {
        user_id: UserId,
    },
    Action {
        user_id: UserId,
        action_type: ActionType,
        amount: Option<ChipAmount>,
    },
    StartHand,
    Timeout {
        user_id: UserId,
    },
}

#[derive(Debug, Clone)]
struct Player {
    user_id: UserId,
    seat: u8,
    player_id: PlayerId,
    stack: ChipAmount,
    pub time_bank_remaining_seconds: u32,
}

impl Player {
    fn new(user_id: UserId, seat: u8, stack: ChipAmount) -> Self {
        Self {
            user_id,
            seat,
            player_id: PlayerId(Uuid::new_v4()),
            stack,
            time_bank_remaining_seconds: 0,
        }
    }
}

struct ActiveHand {
    state: GameState,
    user_by_player_id: HashMap<PlayerId, UserId>,
    player_by_user_id: HashMap<UserId, PlayerId>,
    dealer_index: usize,
    timeout_handle: Option<tokio::task::JoinHandle<()>>,
}

impl ActiveHand {
    fn new(
        state: GameState,
        user_by_player_id: HashMap<PlayerId, UserId>,
        player_by_user_id: HashMap<UserId, PlayerId>,
        dealer_index: usize,
    ) -> Self {
        Self {
            state,
            user_by_player_id,
            player_by_user_id,
            dealer_index,
            timeout_handle: None,
        }
    }
    fn cancel_timeout(&mut self) {
        if let Some(handle) = self.timeout_handle.take() {
            handle.abort();
        }
    }
    fn schedule_timeout(&mut self, user_id: UserId, cmd_tx: mpsc::Sender<InternalCommand>) {
        self.cancel_timeout();
        let tx = cmd_tx.clone();
        let handle = tokio::spawn(async move {
            sleep(Duration::from_secs(30)).await;
            let _ = tx.send(InternalCommand::Timeout { user_id }).await;
        });
        self.timeout_handle = Some(handle);
    }
    fn current_player_user(&self) -> Option<UserId> {
        self.state
            .current_player_id()
            .and_then(|pid| self.user_by_player_id.get(&pid).cloned())
    }
    fn player_stack(&self, user_id: UserId) -> Option<ChipAmount> {
        self.player_by_user_id
            .get(&user_id)
            .and_then(|pid| self.state.player_stack(*pid))
    }
    fn player_current_bet(&self, user_id: UserId) -> Option<ChipAmount> {
        self.player_by_user_id
            .get(&user_id)
            .and_then(|pid| self.state.player_current_bet(*pid))
    }
    fn player_is_all_in(&self, user_id: UserId) -> bool {
        self.player_by_user_id
            .get(&user_id)
            .map(|pid| self.state.player_is_all_in(*pid))
            .unwrap_or(false)
    }
}

pub struct TableActor {
    table_id: TableId,
    config: TableConfig,
    players: HashMap<UserId, Player>,
    current_hand: Option<ActiveHand>,
    broadcast_tx: BroadcastSender<ServerMessage>,
    cmd_tx: mpsc::Sender<InternalCommand>,
    current_timer: Option<Pin<Box<Sleep>>>,
    current_timer_player: Option<PlayerId>,
    current_main_timer_remaining_ms: Option<u64>,
    player_user_map: HashMap<PlayerId, UserId>,
}

impl TableActor {
    pub fn new(
        table_id: TableId,
        config: TableConfig,
        broadcast_tx: BroadcastSender<ServerMessage>,
        cmd_tx: mpsc::Sender<InternalCommand>,
    ) -> Self {
        Self {
            table_id,
            config,
            players: HashMap::new(),
            current_hand: None,
            broadcast_tx,
            cmd_tx,

            current_timer: None,
            current_timer_player: None,
            current_main_timer_remaining_ms: None,
            player_user_map: HashMap::new(),
        }
    }

    pub async fn run(mut self, mut rx: mpsc::Receiver<InternalCommand>) {
        let span = span!(Level::INFO, "table_actor", table_id = %self.table_id);
        async move {
            info!("Table actor started");
            while let Some(cmd) = rx.recv().await {
                self.handle_command(cmd).await;
            }
            info!("Table actor terminated");
        }
        .instrument(span)
        .await;
    }

    async fn handle_command(&mut self, cmd: InternalCommand) {
        debug!(?cmd);
        match cmd {
            InternalCommand::Join {
                user_id,
                seat,
                stack,
            } => self.join_player(user_id, seat, stack).await,
            InternalCommand::Leave { user_id } => self.leave_player(user_id).await,
            InternalCommand::Action {
                user_id,
                action_type,
                amount,
            } => self.process_action(user_id, action_type, amount).await,
            InternalCommand::StartHand => self.start_new_hand().await,
            InternalCommand::Timeout { user_id } => self.handle_timeout(user_id).await,
        }
    }

    async fn join_player(&mut self, user_id: UserId, seat: u8, stack: ChipAmount) {
        if self.players.contains_key(&user_id) {
            warn!(%user_id, "Already at table");
            self.send_error(&user_id, "Already at table").await;
            return;
        }
        if self.players.values().any(|p| p.seat == seat) {
            warn!(seat, "Seat occupied");
            self.send_error(&user_id, &format!("Seat {} taken", seat))
                .await;
            return;
        }
        if seat >= self.config.max_players {
            warn!(seat, max = self.config.max_players, "Invalid seat");
            self.send_error(&user_id, "Seat out of range").await;
            return;
        }
        if stack < self.config.min_buy_in {
            warn!(%user_id, stack = ?stack, min = ?self.config.min_buy_in, "Below min buy-in");
            self.send_error(&user_id, "Buy-in too low").await;
            return;
        }
        let player = Player::new(user_id, seat, stack);
        self.players.insert(player.user_id, player);
        self.broadcast_table_state().await;
        info!(%user_id, seat, "Joined");
    }

    async fn leave_player(&mut self, user_id: UserId) {
        if let Some(_p) = self.players.remove(&user_id) {
            if let Some(hand) = &mut self.current_hand
                && let Some(pid) = hand.player_by_user_id.get(&user_id)
            {
                let _ = hand.state.apply_action(*pid, Action::Fold);
                hand.cancel_timeout();
                self.check_hand_completion().await;
            }
            self.broadcast_table_state().await;
            info!(%user_id, "Left");
        }
    }

    async fn start_new_hand(&mut self) {
        if self.current_hand.is_some() {
            warn!("Hand already in progress");
            return;
        }
        if self.players.len() < 2 {
            warn!("Not enough players");
            return;
        }

        let dealer_index = self
            .current_hand
            .as_ref()
            .map(|h| (h.dealer_index + 1) % self.players.len())
            .unwrap_or(0);
        let (sb, bb) = blinds_for_stake(self.config.stake_level);

        let mut player_list: Vec<&Player> = self.players.values().collect();
        player_list.sort_by_key(|p| p.seat);
        let players_for_engine: Vec<(PlayerId, ChipAmount)> =
            player_list.iter().map(|p| (p.player_id, p.stack)).collect();

        let small_idx = (dealer_index + 1) % players_for_engine.len();
        let big_idx = (dealer_index + 2) % players_for_engine.len();
        if players_for_engine[small_idx].1 < sb {
            error!("Small blind insufficient");
            return;
        }
        if players_for_engine[big_idx].1 < bb {
            error!("Big blind insufficient");
            return;
        }

        let state = match GameState::new_hand(players_for_engine, dealer_index, (sb, bb)) {
            Ok(s) => s,
            Err(e) => {
                error!(error = %e, "Failed to create hand");
                return;
            }
        };

        let mut user_by_player_id = HashMap::new();
        let mut player_by_user_id = HashMap::new();
        for player in self.players.values() {
            user_by_player_id.insert(player.player_id, player.user_id);
            player_by_user_id.insert(player.user_id, player.player_id);
        }

        let mut active = ActiveHand::new(state, user_by_player_id, player_by_user_id, dealer_index);
        if let Some(user) = active.current_player_user() {
            active.schedule_timeout(user, self.cmd_tx.clone());
        }
        self.current_hand = Some(active);
        self.broadcast_table_state().await;
        info!(dealer_index, "Hand started");
    }

    async fn process_action(
        &mut self,
        user_id: UserId,
        action_type: ActionType,
        amount: Option<ChipAmount>,
    ) {
        let hand = match &mut self.current_hand {
            Some(h) => h,
            None => {
                warn!(%user_id, "No active hand");
                self.send_error(&user_id, "No hand").await;
                return;
            }
        };
        if hand.current_player_user() != Some(user_id) {
            warn!(%user_id, "Not your turn");
            self.send_error(&user_id, "Not your turn").await;
            return;
        }
        let player_id = match hand.player_by_user_id.get(&user_id) {
            Some(pid) => *pid,
            None => {
                warn!(%user_id, "Player not in hand");
                self.send_error(&user_id, "Not in hand").await;
                return;
            }
        };
        let engine_action = match action_type {
            ActionType::Fold => Action::Fold,
            ActionType::Check => Action::Check,
            ActionType::Call => Action::Call,
            ActionType::Raise => {
                let raise = amount.unwrap_or_else(zero);
                let min_raise = hand.state.min_raise_amount();
                if raise < min_raise {
                    warn!(%user_id, raise = ?raise, min = ?min_raise);
                    self.send_error(&user_id, &format!("Minimum raise is {}", min_raise))
                        .await;
                    return;
                }
                Action::Raise(raise)
            }
            _ => {
                self.send_error(&user_id, "Unsupported action").await;
                return;
            }
        };
        match hand.state.apply_action(player_id, engine_action) {
            Ok(()) => {
                hand.cancel_timeout();
                if let Some(next) = hand.current_player_user() {
                    hand.schedule_timeout(next, self.cmd_tx.clone());
                } else {
                    self.check_hand_completion().await;
                }
                self.broadcast_table_state().await;
            }
            Err(e) => {
                let msg = match e {
                    ActionError::NotYourTurn => "Not your turn".into(),
                    ActionError::AlreadyFolded => "Already folded".into(),
                    ActionError::AlreadyAllIn => "Already all-in".into(),
                    ActionError::InvalidRaise { .. } => "Invalid raise".into(),
                    ActionError::HandComplete => "Hand finished".into(),
                    ActionError::ShowdownNotActionable => "No actions in showdown".into(),
                    ActionError::InsufficientStack { action, .. } => {
                        format!("Insufficient stack to {}", action)
                    }
                };
                self.send_error(&user_id, &msg).await;
            }
        }
    }

    async fn handle_timeout(&mut self, user_id: UserId) {
        let hand = match &mut self.current_hand {
            Some(h) => h,
            None => return,
        };
        if hand.current_player_user() != Some(user_id) {
            return;
        }
        info!(%user_id, "Auto‑fold timeout");
        let pid = match hand.player_by_user_id.get(&user_id) {
            Some(p) => *p,
            None => return,
        };
        let _ = hand.state.apply_action(pid, Action::Fold);
        hand.cancel_timeout();
        if let Some(next) = hand.current_player_user() {
            hand.schedule_timeout(next, self.cmd_tx.clone());
        } else {
            self.check_hand_completion().await;
        }
        self.broadcast_table_state().await;
    }

    async fn check_hand_completion(&mut self) {
        let mut hand = match self.current_hand.take() {
            Some(h) => h,
            None => return,
        };
        hand.cancel_timeout();
        if !hand.state.is_hand_complete() {
            self.current_hand = Some(hand);
            return;
        }
        let winners = hand.state.calculate_pot_winners();
        for winner in &winners {
            if let Some(user) = hand.user_by_player_id.get(&winner.player_id)
                && let Some(player) = self.players.get_mut(user)
            {
                player.stack = player
                    .stack
                    .checked_add(winner.amount)
                    .unwrap_or(player.stack);
            }
        }
        self.current_hand = None;
        self.broadcast_table_state().await;
    }

    async fn broadcast_table_state(&self) {
        let players_state = if let Some(hand) = &self.current_hand {
            self.players
                .keys()
                .map(|uid| {
                    let stack = hand.player_stack(*uid).unwrap_or_else(zero);
                    let bet = hand.player_current_bet(*uid).unwrap_or_else(zero);
                    let all_in = hand.player_is_all_in(*uid);
                    (*uid, stack, bet, all_in)
                })
                .collect()
        } else {
            self.players
                .iter()
                .map(|(uid, p)| (*uid, p.stack, zero(), false))
                .collect()
        };
        let community = self
            .current_hand
            .as_ref()
            .map(|h| {
                h.state
                    .community_cards()
                    .iter()
                    .map(|c| WsCard {
                        suit: c.suit.to_string(),
                        rank: c.rank.to_string(),
                    })
                    .collect()
            })
            .unwrap_or_default();
        let msg = ServerMessage::TableState(TableStateUpdate {
            table_id: self.table_id,
            players: players_state,
            current_hand_in_progress: self.current_hand.is_some(),
            community_cards: community,
        });
        if let Err(e) = self.broadcast_tx.send(msg) {
            error!(error = %e, "Failed to broadcast");
        }
    }

    async fn send_error(&self, user_id: &UserId, msg: &str) {
        warn!(%user_id, "Error: {}", msg);
        // In production, send via dedicated user channel
    }

    fn start_timer(&mut self, player_id: PlayerId, duration_ms: u64) {
        let sleep = Box::pin(sleep(Duration::from_millis(duration_ms)));
        self.current_timer = Some(sleep);
        self.current_timer_player = Some(player_id);
        self.current_main_timer_remaining_ms = Some(duration_ms);
        info!(?player_id, duration_ms, "Timer started");
    }

    fn cancel_timer(&mut self) {
        if let Some(player_id) = self.current_timer_player {
            info!(?player_id, "Timer cancelled");
        }
        self.current_timer = None;
        self.current_timer_player = None;
        self.current_main_timer_remaining_ms = None;
    }

    async fn on_timer_expiry(&mut self) -> Result<(), AppError> {
        let player_id = match self.current_timer_player.take() {
            Some(pid) => pid,
            None => return Ok(()),
        };
        self.current_timer = None;

        info!(?player_id, "Timer expired for player");

        let user_id = *self
            .player_user_map
            .get(&player_id)
            .ok_or_else(|| AppError::NotFound("player not found".to_string()))?;
        let player_state = self
            .players
            .get_mut(&user_id)
            .ok_or_else(|| AppError::NotFound("player not found".to_string()))?;

        if player_state.time_bank_remaining_seconds > 0 {
            player_state.time_bank_remaining_seconds -= 1;
            info!(
                ?player_id,
                bank_remaining = player_state.time_bank_remaining_seconds,
                "Consumed 1s from bank, resetting timer"
            );
            self.start_timer(player_id, DEFAULT_TIMER_MS);
            // TODO: broadcast ActionRequired with remaining_ms after #001
        } else {
            warn!(?player_id, "Time bank exhausted, auto‑folding");
            self.process_action(user_id, ActionType::Fold, None).await;
        }
        Ok(())
    }

    /// Removes a player from the actor state, cleaning up the player_user_map.
    pub fn remove_player(&mut self, user_id: &UserId) {
        if let Some(player_id) = self
            .player_user_map
            .iter()
            .find_map(|(pid, uid)| if uid == user_id { Some(*pid) } else { None })
        {
            self.player_user_map.remove(&player_id);
            self.players.remove(user_id);
            info!(?player_id, ?user_id, "Player removed from table");
        }
    }
}

pub fn spawn_table_actor(
    table_id: TableId,
    config: TableConfig,
    broadcast_tx: BroadcastSender<ServerMessage>,
) -> (mpsc::Sender<InternalCommand>, tokio::task::JoinHandle<()>) {
    let (tx, rx) = mpsc::channel(32);
    let actor = TableActor::new(table_id, config, broadcast_tx, tx.clone());
    let handle = tokio::spawn(actor.run(rx));
    (tx, handle)
}

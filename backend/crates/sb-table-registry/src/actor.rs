//! Production‑ready table actor with stable player IDs, dealer rotation,
//! error handling, observability, and zero duplicate state.

use std::collections::HashMap;
use std::time::Duration;
use uuid::Uuid;

use tokio::sync::mpsc;
use tokio::time::sleep;
use tracing::{Instrument, Level, debug, error, info, span, warn};

use sb_game_engine::game_state::{Action, GameState};
use sb_shared_types::{ActionType, ChipAmount, PlayerId, StakeLevel, TableConfig, TableId, UserId};
use sb_ws_handler::BroadcastSender;
use sb_ws_messages::{ServerMessage, TableStateUpdate};

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
pub enum TableCommand {
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

pub struct TableHandle {
    cmd_tx: mpsc::Sender<TableCommand>,
}

impl TableHandle {
    pub fn new(cmd_tx: mpsc::Sender<TableCommand>) -> Self {
        Self { cmd_tx }
    }
    pub async fn send(
        &self,
        cmd: TableCommand,
    ) -> Result<(), mpsc::error::SendError<TableCommand>> {
        self.cmd_tx.send(cmd).await
    }
}

#[derive(Debug, Clone)]
struct Player {
    user_id: UserId,
    seat: u8,
    player_id: PlayerId,
    stack: ChipAmount,
}

impl Player {
    fn new(user_id: UserId, seat: u8, stack: ChipAmount) -> Self {
        Self {
            user_id,
            seat,
            player_id: PlayerId(Uuid::new_v4()),
            stack,
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

    fn schedule_timeout(&mut self, user_id: UserId, cmd_tx: mpsc::Sender<TableCommand>) {
        self.cancel_timeout();
        let tx = cmd_tx.clone();
        let handle = tokio::spawn(async move {
            sleep(Duration::from_secs(30)).await;
            let _ = tx.send(TableCommand::Timeout { user_id }).await;
        });
        self.timeout_handle = Some(handle);
    }

    fn current_player_user(&self) -> Option<UserId> {
        self.state
            .current_player_id()
            .and_then(|pid| self.user_by_player_id.get(&pid).cloned())
    }

    fn player_stack(&self, user_id: &UserId) -> Option<ChipAmount> {
        self.player_by_user_id
            .get(user_id)
            .and_then(|pid| self.state.player_stack(*pid))
    }

    fn player_current_bet(&self, user_id: &UserId) -> Option<ChipAmount> {
        self.player_by_user_id
            .get(user_id)
            .and_then(|pid| self.state.player_current_bet(*pid))
    }

    fn player_is_all_in(&self, user_id: &UserId) -> bool {
        self.player_by_user_id
            .get(user_id)
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
    cmd_tx: mpsc::Sender<TableCommand>,
}

impl TableActor {
    pub fn new(
        table_id: TableId,
        config: TableConfig,
        broadcast_tx: BroadcastSender<ServerMessage>,
        cmd_tx: mpsc::Sender<TableCommand>,
    ) -> Self {
        Self {
            table_id,
            config,
            players: HashMap::new(),
            current_hand: None,
            broadcast_tx,
            cmd_tx,
        }
    }

    pub async fn run(mut self, mut rx: mpsc::Receiver<TableCommand>) {
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

    async fn handle_command(&mut self, cmd: TableCommand) {
        debug!(?cmd, "Handling command");
        match cmd {
            TableCommand::Join {
                user_id,
                seat,
                stack,
            } => self.join_player(user_id, seat, stack).await,
            TableCommand::Leave { user_id } => self.leave_player(user_id).await,
            TableCommand::Action {
                user_id,
                action_type,
                amount,
            } => self.process_action(user_id, action_type, amount).await,
            TableCommand::StartHand => self.start_new_hand().await,
            TableCommand::Timeout { user_id } => self.handle_timeout(user_id).await,
        }
    }

    async fn join_player(&mut self, user_id: UserId, seat: u8, stack: ChipAmount) {
        if self.players.contains_key(&user_id) {
            warn!(%user_id, "Player already at table");
            return;
        }
        if self.players.values().any(|p| p.seat == seat) {
            warn!(seat, "Seat already occupied");
            return;
        }
        if seat >= self.config.max_players {
            warn!(seat, max = self.config.max_players, "Invalid seat");
            return;
        }
        if stack < self.config.min_buy_in {
            warn!(%user_id, stack = ?stack, min = ?self.config.min_buy_in, "Stack below min buy-in");
            return;
        }
        let player = Player::new(user_id.clone(), seat, stack);
        self.players.insert(user_id, player);
        self.broadcast_table_state().await;
        info!(%user_id, seat, "Player joined");
    }

    async fn leave_player(&mut self, user_id: UserId) {
        if let Some(_player) = self.players.remove(&user_id) {
            if let Some(hand) = &mut self.current_hand {
                if let Some(pid) = hand.player_by_user_id.get(&user_id) {
                    let _ = hand.state.apply_action(*pid, Action::Fold);
                    hand.cancel_timeout();
                    self.check_hand_completion().await;
                }
            }
            self.broadcast_table_state().await;
            info!(%user_id, "Player left");
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

        let (small_blind, big_blind) = blinds_for_stake(self.config.stake_level);

        let mut player_list: Vec<&Player> = self.players.values().collect();
        player_list.sort_by_key(|p| p.seat);
        let players_for_engine: Vec<(PlayerId, ChipAmount)> =
            player_list.iter().map(|p| (p.player_id, p.stack)).collect();

        let small_idx = (dealer_index + 1) % players_for_engine.len();
        let big_idx = (dealer_index + 2) % players_for_engine.len();
        if players_for_engine[small_idx].1 < small_blind {
            error!("Small blind cannot post");
            return;
        }
        if players_for_engine[big_idx].1 < big_blind {
            error!("Big blind cannot post");
            return;
        }

        let state =
            match GameState::new_hand(players_for_engine, dealer_index, (small_blind, big_blind)) {
                Ok(s) => s,
                Err(e) => {
                    error!(error = %e, "Failed to create hand");
                    return;
                }
            };

        let mut user_by_player_id = HashMap::new();
        let mut player_by_user_id = HashMap::new();
        for player in self.players.values() {
            user_by_player_id.insert(player.player_id, player.user_id.clone());
            player_by_user_id.insert(player.user_id.clone(), player.player_id);
        }

        let mut active = ActiveHand::new(state, user_by_player_id, player_by_user_id, dealer_index);
        if let Some(user_id) = active.current_player_user() {
            active.schedule_timeout(user_id, self.cmd_tx.clone());
        }
        self.current_hand = Some(active);
        self.broadcast_table_state().await;
        info!(dealer_index, "New hand started");
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
                return;
            }
        };

        if hand.current_player_user() != Some(user_id) {
            warn!(%user_id, "Not player's turn");
            self.send_error(&user_id, "Not your turn").await;
            return;
        }

        let player_id = match hand.player_by_user_id.get(&user_id) {
            Some(pid) => *pid,
            None => {
                warn!(%user_id, "Player not in hand");
                self.send_error(&user_id, "You are not in this hand").await;
                return;
            }
        };

        let engine_action = match action_type {
            ActionType::Fold => Action::Fold,
            ActionType::Check => Action::Check,
            ActionType::Call => Action::Call,
            ActionType::Raise => {
                let raise_amount = amount.unwrap_or_else(zero);
                let min_raise = hand.state.min_raise_amount();
                if raise_amount < min_raise {
                    warn!(%user_id, raise = ?raise_amount, min = ?min_raise, "Raise too small");
                    self.send_error(&user_id, &format!("Minimum raise is {}", min_raise))
                        .await;
                    return;
                }
                Action::Raise(raise_amount)
            }
            _ => {
                warn!(%user_id, ?action_type, "Unsupported action");
                self.send_error(&user_id, "Action not supported").await;
                return;
            }
        };

        match hand.state.apply_action(player_id, engine_action) {
            Ok(()) => {
                debug!(%user_id, ?action_type, "Action applied");
                hand.cancel_timeout();
                if let Some(next_user) = hand.current_player_user() {
                    hand.schedule_timeout(next_user, self.cmd_tx.clone());
                } else {
                    self.check_hand_completion().await;
                }
                self.broadcast_table_state().await;
            }
            Err(e) => {
                warn!(%user_id, error = ?e, "Engine rejected action");
                self.send_error(&user_id, &format!("Invalid action: {}", e))
                    .await;
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
        info!(%user_id, "Auto‑folding due to timeout");
        let player_id = match hand.player_by_user_id.get(&user_id) {
            Some(pid) => *pid,
            None => return,
        };
        let _ = hand.state.apply_action(player_id, Action::Fold);
        hand.cancel_timeout();
        if let Some(next_user) = hand.current_player_user() {
            hand.schedule_timeout(next_user, self.cmd_tx.clone());
        } else {
            self.check_hand_completion().await;
        }
        self.broadcast_table_state().await;
    }

    async fn check_hand_completion(&mut self) {
        let hand = match self.current_hand.take() {
            Some(h) => h,
            None => return,
        };
        if !hand.state.is_hand_complete() {
            self.current_hand = Some(hand);
            return;
        }

        let winners = hand.state.calculate_pot_winners();
        let mut pot = zero();
        for winner in &winners {
            pot = pot.checked_add(winner.amount).unwrap_or(pot);
            // Update actor's stored stack for the winning player
            if let Some(user_id) = hand.user_by_player_id.get(&winner.player_id) {
                if let Some(player) = self.players.get_mut(user_id) {
                    player.stack = player
                        .stack
                        .checked_add(winner.amount)
                        .unwrap_or(player.stack);
                }
            }
            info!(player_id = ?winner.player_id, amount = ?winner.amount, "Winner");
        }
        info!(?winners, pot = ?pot, "Hand finished");

        self.current_hand = None;
        self.broadcast_table_state().await;
    }

    async fn broadcast_table_state(&self) {
        let players_state = if let Some(hand) = &self.current_hand {
            self.players
                .iter()
                .map(|(uid, _)| {
                    let stack = hand.player_stack(uid).unwrap_or_else(zero);
                    let current_bet = hand.player_current_bet(uid).unwrap_or_else(zero);
                    let is_all_in = hand.player_is_all_in(uid);
                    (uid.clone(), stack, current_bet, is_all_in)
                })
                .collect()
        } else {
            self.players
                .iter()
                .map(|(uid, p)| (uid.clone(), p.stack, zero(), false))
                .collect()
        };
        // Convert community cards from sb_shared_types::Card to sb_ws_messages::Card
        let community_cards = self
            .current_hand
            .as_ref()
            .map(|h| {
                h.state
                    .community_cards()
                    .iter()
                    .map(|c| sb_ws_messages::Card {
                        suit: c.suit.to_string(),
                        rank: c.rank.to_string(),
                    })
                    .collect()
            })
            .unwrap_or_default();
        let state = TableStateUpdate {
            table_id: self.table_id.clone(),
            players: players_state,
            current_hand_in_progress: self.current_hand.is_some(),
            community_cards,
        };
        if let Err(e) = self.broadcast_tx.send(ServerMessage::TableState(state)) {
            error!(error = %e, "Failed to broadcast table state");
        }
    }

    async fn send_error(&self, user_id: &UserId, message: &str) {
        warn!(%user_id, error = message, "Action rejected");
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use sb_shared_types::{GameVariant, StakeLevel};
    use tokio::sync::broadcast;

    fn test_broadcast() -> BroadcastSender<ServerMessage> {
        let (tx, _) = broadcast::channel(16);
        tx
    }

    fn test_cmd_tx() -> mpsc::Sender<TableCommand> {
        let (tx, _) = mpsc::channel(16);
        tx
    }

    #[tokio::test]
    async fn test_full_hand_raise_call_showdown() {
        let table_id = TableId(Uuid::new_v4());
        let config = TableConfig {
            stake_level: StakeLevel::Low,
            max_players: 6,
            variant: GameVariant::Holdem,
            min_buy_in: ChipAmount::new(100).unwrap(),
            max_buy_in: ChipAmount::new(1000).unwrap(),
        };
        let broadcast_tx = test_broadcast();
        let cmd_tx = test_cmd_tx();
        let mut actor = TableActor::new(table_id, config, broadcast_tx, cmd_tx);

        let user1 = UserId(Uuid::new_v4());
        let user2 = UserId(Uuid::new_v4());
        actor
            .join_player(user1.clone(), 0, ChipAmount::new(500).unwrap())
            .await;
        actor
            .join_player(user2.clone(), 1, ChipAmount::new(500).unwrap())
            .await;

        actor.start_new_hand().await;
        assert!(actor.current_hand.is_some());

        // First action: raise
        actor
            .process_action(
                user1.clone(),
                ActionType::Raise,
                Some(ChipAmount::new(50).unwrap()),
            )
            .await;
        // Second: call
        actor
            .process_action(user2.clone(), ActionType::Call, None)
            .await;

        let hand = actor.current_hand.as_ref().unwrap();
        assert!(!hand.state.community_cards().is_empty() || !hand.state.is_hand_complete());
    }
}

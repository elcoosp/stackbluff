//! Table actor – owns game state, processes commands, broadcasts updates.

use std::collections::HashMap;
use std::time::Duration;

use tokio::sync::{mpsc, broadcast};
use tokio::time::sleep;
use tracing::{info, warn, error, debug};

use sb_shared_types::{UserId, ChipAmount, TableId, TableConfig, StakeLevel};
use sb_game_engine::{GameEngine, ActionType};
use sb_ws_messages::{ServerMessage, TableStateUpdate, ActionRequired, HandResult, Card};
use sb_ws_handler::BroadcastSender;

#[derive(Debug, Clone)]
pub enum TableCommand {
    Join { user_id: UserId, seat: u8, stack: ChipAmount },
    Leave { user_id: UserId },
    Action { user_id: UserId, action_type: ActionType, amount: Option<ChipAmount> },
    StartHand,
    Timeout { user_id: UserId },
}

pub struct TableHandle {
    cmd_tx: mpsc::Sender<TableCommand>,
}

impl TableHandle {
    pub fn new(cmd_tx: mpsc::Sender<TableCommand>) -> Self { Self { cmd_tx } }
    pub async fn send(&self, cmd: TableCommand) -> Result<(), mpsc::error::SendError<TableCommand>> {
        self.cmd_tx.send(cmd).await
    }
}

#[derive(Debug, Clone)]
struct Player {
    user_id: UserId,
    seat: u8,
    stack: ChipAmount,
    current_bet: ChipAmount,
    is_all_in: bool,
}

impl Player {
    fn new(user_id: UserId, seat: u8, stack: ChipAmount) -> Self {
        Self { user_id, seat, stack, current_bet: ChipAmount::ZERO, is_all_in: false }
    }
}

struct ActiveHand {
    engine: GameEngine,
    players: HashMap<UserId, Player>,
    timeout_user_id: Option<UserId>,
    timeout_handle: Option<tokio::task::JoinHandle<()>>,
}

impl ActiveHand {
    fn new(engine: GameEngine, players: HashMap<UserId, Player>) -> Self {
        Self { engine, players, timeout_user_id: None, timeout_handle: None }
    }

    fn cancel_timeout(&mut self) {
        if let Some(handle) = self.timeout_handle.take() { handle.abort(); }
        self.timeout_user_id = None;
    }

    fn schedule_timeout(&mut self, user_id: UserId, cmd_tx: mpsc::Sender<TableCommand>) {
        self.cancel_timeout();
        self.timeout_user_id = Some(user_id.clone());
        let tx = cmd_tx.clone();
        let handle = tokio::spawn(async move {
            sleep(Duration::from_secs(30)).await;
            let _ = tx.send(TableCommand::Timeout { user_id }).await;
        });
        self.timeout_handle = Some(handle);
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
        Self { table_id, config, players: HashMap::new(), current_hand: None, broadcast_tx, cmd_tx }
    }

    pub async fn run(mut self, mut rx: mpsc::Receiver<TableCommand>) {
        info!("Table actor {} started", self.table_id);
        while let Some(cmd) = rx.recv().await {
            self.handle_command(cmd).await;
        }
        info!("Table actor {} terminated", self.table_id);
    }

    async fn handle_command(&mut self, cmd: TableCommand) {
        debug!("Handling command: {:?}", cmd);
        match cmd {
            TableCommand::Join { user_id, seat, stack } => self.join_player(user_id, seat, stack).await,
            TableCommand::Leave { user_id } => self.leave_player(user_id).await,
            TableCommand::Action { user_id, action_type, amount } => self.process_action(user_id, action_type, amount).await,
            TableCommand::StartHand => self.start_new_hand().await,
            TableCommand::Timeout { user_id } => self.handle_timeout(user_id).await,
        }
    }

    async fn join_player(&mut self, user_id: UserId, seat: u8, stack: ChipAmount) {
        if self.players.contains_key(&user_id) {
            warn!("Player {} already at table", user_id);
            return;
        }
        if self.players.values().any(|p| p.seat == seat) {
            warn!("Seat {} already occupied", seat);
            return;
        }
        let player = Player::new(user_id.clone(), seat, stack);
        self.players.insert(user_id, player);
        self.broadcast_table_state().await;
    }

    async fn leave_player(&mut self, user_id: UserId) {
        if let Some(_player) = self.players.remove(&user_id) {
            if let Some(hand) = &mut self.current_hand {
                if hand.players.contains_key(&user_id) {
                    let _ = hand.engine.process_action(&user_id, ActionType::Fold, None);
                    hand.cancel_timeout();
                    self.check_hand_completion().await;
                }
            }
            self.broadcast_table_state().await;
        }
    }

    async fn start_new_hand(&mut self) {
        if self.current_hand.is_some() {
            warn!("Hand already in progress");
            return;
        }
        if self.players.len() < 2 {
            warn!("Not enough players to start hand");
            return;
        }

        for player in self.players.values_mut() {
            player.current_bet = ChipAmount::ZERO;
            player.is_all_in = false;
        }

        let players_for_engine: HashMap<UserId, ChipAmount> = self.players
            .iter()
            .map(|(id, p)| (id.clone(), p.stack))
            .collect();

        let mut engine = GameEngine::new(self.config.stake_level.clone(), players_for_engine);
        if let Err(e) = engine.start_hand() {
            error!("Failed to start hand: {:?}", e);
            return;
        }

        let snapshot = self.players.clone();
        let mut active = ActiveHand::new(engine, snapshot);
        if let Some(next) = active.engine.current_player() {
            active.schedule_timeout(next.clone(), self.cmd_tx.clone());
            self.broadcast_action_required(next.clone()).await;
        }
        self.current_hand = Some(active);
        self.broadcast_table_state().await;
    }

    async fn process_action(&mut self, user_id: UserId, action_type: ActionType, amount: Option<ChipAmount>) {
        let hand = match &mut self.current_hand {
            Some(h) => h,
            None => { warn!("No active hand"); return; }
        };

        if hand.engine.current_player() != Some(&user_id) {
            warn!("Not {}'s turn", user_id);
            return;
        }

        let player_stack = hand.players.get(&user_id).map(|p| p.stack).unwrap_or(ChipAmount::ZERO);
        if matches!(action_type, ActionType::Raise) {
            let bet = amount.unwrap_or(ChipAmount::ZERO);
            if bet > player_stack {
                warn!("Insufficient stack for raise");
                return;
            }
        }

        if let Err(e) = hand.engine.process_action(&user_id, action_type, amount) {
            warn!("Engine rejected action: {:?}", e);
            return;
        }

        if let Some(player) = self.players.get_mut(&user_id) {
            match action_type {
                ActionType::Call => {
                    let to_call = hand.engine.current_call_amount(&user_id);
                    let call_amount = to_call.min(player.stack);
                    player.stack = ChipAmount::checked_sub(player.stack, call_amount).unwrap_or(ChipAmount::ZERO);
                    player.current_bet = ChipAmount::checked_add(player.current_bet, call_amount).unwrap_or(ChipAmount::ZERO);
                }
                ActionType::Raise => {
                    let raise_amount = amount.unwrap_or(ChipAmount::ZERO);
                    player.stack = ChipAmount::checked_sub(player.stack, raise_amount).unwrap_or(ChipAmount::ZERO);
                    player.current_bet = ChipAmount::checked_add(player.current_bet, raise_amount).unwrap_or(ChipAmount::ZERO);
                }
                _ => {}
            }
            if player.stack == ChipAmount::ZERO { player.is_all_in = true; }
        }

        hand.cancel_timeout();
        if let Some(next_player) = hand.engine.current_player() {
            hand.schedule_timeout(next_player.clone(), self.cmd_tx.clone());
            self.broadcast_action_required(next_player.clone()).await;
        } else {
            self.check_hand_completion().await;
        }
        self.broadcast_table_state().await;
    }

    async fn handle_timeout(&mut self, user_id: UserId) {
        let hand = match &mut self.current_hand {
            Some(h) => h,
            None => return,
        };
        if Some(&user_id) != hand.timeout_user_id.as_ref() { return; }
        info!("Auto‑fold due to timeout for player {}", user_id);
        let _ = hand.engine.process_action(&user_id, ActionType::Fold, None);
        hand.cancel_timeout();
        if let Some(next_player) = hand.engine.current_player() {
            hand.schedule_timeout(next_player.clone(), self.cmd_tx.clone());
            self.broadcast_action_required(next_player.clone()).await;
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
        if !hand.engine.is_hand_complete() {
            self.current_hand = Some(hand);
            return;
        }

        let winners = hand.engine.determine_winners();
        let mut pot = ChipAmount::ZERO;
        for winner in &winners {
            pot = ChipAmount::checked_add(pot, winner.amount).unwrap_or(pot);
            if let Some(player) = self.players.get_mut(&winner.user_id) {
                player.stack = ChipAmount::checked_add(player.stack, winner.amount).unwrap_or(player.stack);
                player.current_bet = ChipAmount::ZERO;
            }
        }

        let hand_result_msg = ServerMessage::HandResult(HandResult {
            table_id: self.table_id.clone(),
            winners: winners.iter().map(|w| (w.user_id.clone(), w.amount)).collect(),
            pot,
            community_cards: hand.engine.community_cards().iter().map(|c| Card { suit: c.suit.clone(), rank: c.rank.clone() }).collect(),
        });
        let _ = self.broadcast_tx.send(hand_result_msg);

        self.current_hand = None;
        self.broadcast_table_state().await;
    }

    async fn broadcast_table_state(&self) {
        let state = TableStateUpdate {
            table_id: self.table_id.clone(),
            players: self.players.iter().map(|(id, p)| (id.clone(), p.stack, p.current_bet, p.is_all_in)).collect(),
            current_hand_in_progress: self.current_hand.is_some(),
            community_cards: self.current_hand.as_ref().map(|h| h.engine.community_cards().iter().map(|c| Card { suit: c.suit.clone(), rank: c.rank.clone() }).collect()).unwrap_or_default(),
        };
        let _ = self.broadcast_tx.send(ServerMessage::TableState(state));
    }

    async fn broadcast_action_required(&self, user_id: UserId) {
        let hand = match &self.current_hand {
            Some(h) => h,
            None => return,
        };
        let to_call = hand.engine.current_call_amount(&user_id);
        let min_raise = hand.engine.min_raise_amount(&user_id);
        let msg = ServerMessage::ActionRequired(ActionRequired {
            user_id,
            to_call,
            min_raise,
            can_check: to_call == ChipAmount::ZERO,
        });
        let _ = self.broadcast_tx.send(msg);
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tokio::sync::broadcast;

    fn test_broadcast() -> BroadcastSender<ServerMessage> {
        let (tx, _) = broadcast::channel(16);
        tx
    }

    fn test_cmd_tx() -> mpsc::Sender<TableCommand> {
        let (tx, _) = mpsc::channel(16);
        tx
    }

    fn new_test_player(id: u64, seat: u8, stack: u64) -> (UserId, Player) {
        let uid = UserId(id.to_string());
        let player = Player::new(uid.clone(), seat, ChipAmount::new(stack).unwrap());
        (uid, player)
    }

    #[tokio::test]
    async fn test_raise_and_call() {
        let table_id = TableId("test1".to_string());
        let config = TableConfig {
            stake_level: StakeLevel::SmallStakes,
            max_players: 6,
            min_buyin: ChipAmount::new(100).unwrap(),
            max_buyin: ChipAmount::new(1000).unwrap(),
        };
        let broadcast_tx = test_broadcast();
        let cmd_tx = test_cmd_tx();
        let mut actor = TableActor::new(table_id, config, broadcast_tx, cmd_tx);
        let (uid1, _) = new_test_player(1, 1, 500);
        let (uid2, _) = new_test_player(2, 2, 500);
        actor.join_player(uid1.clone(), 1, ChipAmount::new(500).unwrap()).await;
        actor.join_player(uid2.clone(), 2, ChipAmount::new(500).unwrap()).await;
        actor.start_new_hand().await;
        assert!(actor.current_hand.is_some());
        actor.process_action(uid1.clone(), ActionType::Raise, Some(ChipAmount::new(50).unwrap())).await;
        actor.process_action(uid2.clone(), ActionType::Call, None).await;
        let hand = actor.current_hand.as_ref().unwrap();
        assert!(!hand.engine.community_cards().is_empty() || !hand.engine.is_hand_complete());
    }
}

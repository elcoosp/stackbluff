//! Table actor using sb-game-engine::GameState.

use std::collections::HashMap;
use std::time::Duration;
use uuid::Uuid;

use tokio::sync::mpsc;
use tokio::time::sleep;
use tracing::{debug, error, info, warn};

use sb_game_engine::game_state::{Action, GameState};
use sb_shared_types::{ActionType, ChipAmount, PlayerId, TableConfig, TableId, UserId};
use sb_ws_handler::BroadcastSender;
use sb_ws_messages::{ServerMessage, TableStateUpdate};

fn zero() -> ChipAmount {
    ChipAmount::new(0).unwrap()
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
    #[allow(dead_code)]
    user_id: UserId,
    seat: u8,
    stack: ChipAmount,
    current_bet: ChipAmount,
    is_all_in: bool,
}

impl Player {
    fn new(user_id: UserId, seat: u8, stack: ChipAmount) -> Self {
        Self {
            user_id,
            seat,
            stack,
            current_bet: zero(),
            is_all_in: false,
        }
    }
}

struct ActiveHand {
    state: GameState,
    players: HashMap<UserId, Player>,
    user_to_player_id: HashMap<UserId, PlayerId>,
    player_id_to_user: HashMap<PlayerId, UserId>,
    timeout_handle: Option<tokio::task::JoinHandle<()>>,
}

impl ActiveHand {
    fn new(
        state: GameState,
        players: HashMap<UserId, Player>,
        mapping: HashMap<UserId, PlayerId>,
    ) -> Self {
        let player_id_to_user = mapping.iter().map(|(u, p)| (*p, u.clone())).collect();
        Self {
            state,
            players,
            user_to_player_id: mapping,
            player_id_to_user,
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

    fn current_user_turn(&self) -> Option<UserId> {
        self.state
            .current_player_id()
            .and_then(|pid| self.player_id_to_user.get(&pid).cloned())
    }
}

pub struct TableActor {
    table_id: TableId,
    config: TableConfig,
    players: HashMap<UserId, Player>,
    current_hand: Option<ActiveHand>,
    broadcast_tx: BroadcastSender<ServerMessage>,
    cmd_tx: mpsc::Sender<TableCommand>,
    next_player_id: u64,
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
            next_player_id: 1,
        }
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
            player.current_bet = zero();
            player.is_all_in = false;
        }

        // Create PlayerId mapping for each user
        let mut mapping = HashMap::new();
        let players_vec: Vec<(PlayerId, ChipAmount)> = self
            .players
            .iter()
            .map(|(uid, p)| {
                let pid = PlayerId(Uuid::new_v4());
                mapping.insert(uid.clone(), pid);
                (pid, p.stack)
            })
            .collect();

        let dealer_index = 0;
        let blinds = (ChipAmount::new(10).unwrap(), ChipAmount::new(20).unwrap());

        let state = match GameState::new_hand(players_vec, dealer_index, blinds) {
            Ok(s) => s,
            Err(e) => {
                error!("Failed to create hand: {}", e);
                return;
            }
        };

        let snapshot = self.players.clone();
        let mut active = ActiveHand::new(state, snapshot, mapping);

        if let Some(user_id) = active.current_user_turn() {
            active.schedule_timeout(user_id, self.cmd_tx.clone());
        }

        self.current_hand = Some(active);
        self.broadcast_table_state().await;
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
                warn!("No active hand");
                return;
            }
        };

        if hand.current_user_turn() != Some(user_id) {
            warn!("Not {}'s turn", user_id);
            return;
        }

        let player_id = match hand.user_to_player_id.get(&user_id) {
            Some(pid) => *pid,
            None => {
                warn!("Player {} not in hand", user_id);
                return;
            }
        };

        let player_stack = hand
            .players
            .get(&user_id)
            .map(|p| p.stack)
            .unwrap_or_else(zero);
        let engine_action = match action_type {
            ActionType::Fold => Action::Fold,
            ActionType::Check => Action::Check,
            ActionType::Call => Action::Call,
            ActionType::Raise => {
                let raise_amount = amount.unwrap_or_else(zero);
                if raise_amount > player_stack {
                    warn!("Insufficient stack for raise");
                    return;
                }
                Action::Raise(raise_amount)
            }
            _ => {
                warn!("Unsupported action: {:?}", action_type);
                return;
            }
        };

        if let Err(e) = hand.state.apply_action(player_id, engine_action) {
            warn!("Engine rejected action: {:?}", e);
            return;
        }

        // Update player stack and current bet
        if let Some(player) = self.players.get_mut(&user_id) {
            match action_type {
                ActionType::Call => {
                    let to_call = hand.state.current_call_amount();
                    let call_amount = to_call.min(player.stack);
                    player.stack = player.stack.checked_sub(call_amount).unwrap_or_else(zero);
                    player.current_bet = player
                        .current_bet
                        .checked_add(call_amount)
                        .unwrap_or_else(zero);
                }
                ActionType::Raise => {
                    let raise_amount = amount.unwrap_or_else(zero);
                    player.stack = player.stack.checked_sub(raise_amount).unwrap_or_else(zero);
                    player.current_bet = player
                        .current_bet
                        .checked_add(raise_amount)
                        .unwrap_or_else(zero);
                }
                _ => {}
            }
            if player.stack == zero() {
                player.is_all_in = true;
            }
        }

        hand.cancel_timeout();
        if let Some(next_user) = hand.current_user_turn() {
            hand.schedule_timeout(next_user, self.cmd_tx.clone());
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

        if hand.current_user_turn() != Some(user_id) {
            return;
        }

        info!("Auto‑fold due to timeout for player {}", user_id);

        let player_id = match hand.user_to_player_id.get(&user_id) {
            Some(pid) => *pid,
            None => return,
        };

        let _ = hand.state.apply_action(player_id, Action::Fold);
        hand.cancel_timeout();

        if let Some(next_user) = hand.current_user_turn() {
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
            if let Some(user_id) = hand.player_id_to_user.get(&winner.player_id) {
                if let Some(player) = self.players.get_mut(user_id) {
                    player.stack = player
                        .stack
                        .checked_add(winner.amount)
                        .unwrap_or(player.stack);
                    player.current_bet = zero();
                }
            }
        }

        self.current_hand = None;
        self.broadcast_table_state().await;
    }

    async fn broadcast_table_state(&self) {
        let state = TableStateUpdate {
            table_id: self.table_id.clone(),
            players: self
                .players
                .iter()
                .map(|(id, p)| (id.clone(), p.stack, p.current_bet, p.is_all_in))
                .collect(),
            current_hand_in_progress: self.current_hand.is_some(),
            community_cards: vec![],
        };
        let _ = self.broadcast_tx.send(ServerMessage::TableState(state));
    }
}

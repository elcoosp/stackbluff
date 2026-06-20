use sb_shared_types::{ChipAmount, TableId, UserId};
use serde::Serialize;
use std::collections::HashMap;
use tokio::sync::mpsc;

// === Broadcast types ===
pub type BroadcastSender = tokio::sync::broadcast::Sender<RoomMessage>;

pub fn broadcast_channel(capacity: usize) -> BroadcastSender {
    let (tx, _) = tokio::sync::broadcast::channel(capacity);
    tx
}

// === WebSocket message types ===

#[derive(Debug, Clone, Serialize)]
pub struct WsCard {
    pub suit: String,
    pub rank: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct SidePotMessage {
    pub amount: u64,
    pub eligible_players: Vec<UserId>,
}
#[derive(Debug, Clone, Serialize)]
pub struct ActionInfo {
    pub text: String,
    pub amount: Option<u64>,
}

#[derive(Debug, Clone, Serialize)]
pub struct PlayerStateInfo {
    pub user_id: UserId,
    pub display_name: String,
    pub seat: u8,
    pub stack: ChipAmount,
    pub current_bet: ChipAmount,
    pub is_all_in: bool,
    pub is_folded: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub position_badge: Option<String>,
    pub last_action: Option<ActionInfo>,
}

#[derive(Debug, Clone, Serialize)]
pub struct TableStateUpdate {
    pub table_id: TableId,
    pub players: Vec<PlayerStateInfo>,
    pub current_hand_in_progress: bool,
    pub community_cards: Vec<WsCard>,
    pub current_turn_user_id: Option<UserId>,
    pub current_turn_expires_at: Option<u64>,
    pub current_turn_timeout_ms: Option<u64>,
    pub street: String,
    pub pot: u64,
    pub side_pots: Vec<SidePotMessage>,
}

#[derive(Debug, Clone, Serialize)]
pub struct AnalyticsPayload {
    pub win_prob: u8,
    pub pot_odds: f32,
    pub best_hand: String,
    pub strength: u8,
}

#[derive(Debug, Clone, Serialize)]
pub struct ActionRequired {
    pub player_id: UserId,
    pub expires_at: u64,
    pub timeout_ms: u64,
    pub to_call: u64,
    pub min_raise: u64,
    pub can_check: bool,
    pub pot: u64,
}

#[derive(Debug, Clone, Serialize)]
pub struct ActionBroadcast {
    pub player_id: UserId,
    pub action: String,
    pub amount: Option<u64>,
    pub new_stack: u64,
    pub new_pot: u64,
}

// ── Showdown types ──

#[derive(Debug, Clone, Serialize)]
pub struct ShowdownPlayer {
    pub user_id: UserId,
    pub display_name: String,
    pub seat: u8,
    pub hole_cards: Vec<WsCard>,
    pub hand_description: String,
    pub is_winner: bool,
    pub win_amount: u64,
    pub winning_cards: Vec<WsCard>,
}

#[derive(Debug, Clone, Serialize)]
pub struct ShowdownReveal {
    pub players: Vec<ShowdownPlayer>,
    pub community_cards: Vec<WsCard>,
    pub pot: u64,
}

// ── Hand result types ──

#[derive(Debug, Clone, Serialize)]
pub struct WinnerResult {
    pub user_id: UserId,
    pub display_name: String,
    pub amount: u64,
    pub hand_rank: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct HandResult {
    pub winners: Vec<WinnerResult>,
    pub pot: u64,
}

// ── Room message enum ──

#[derive(Debug, Clone, Serialize)]
#[serde(tag = "type")]
pub enum RoomMessage {
    #[serde(rename = "TableState")]
    TableState(TableStateUpdate),
    #[serde(rename = "ActionRequired")]
    ActionRequired(ActionRequired),
    #[serde(rename = "ActionBroadcast")]
    ActionBroadcast(ActionBroadcast),
    #[serde(rename = "ShowdownReveal")]
    ShowdownReveal(ShowdownReveal),
    #[serde(rename = "HandResult")]
    HandResult(HandResult),
    #[serde(rename = "Error")]
    Error {
        target_user_id: Option<UserId>,
        message: String,
    },
    #[serde(rename = "Connected")]
    Connected { user_id: UserId, seat_index: u8 },
    #[serde(rename = "PrivateMessage")]
    PrivateMessage {
        target_user_id: UserId,
        payload: PrivatePayload,
    },
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "snake_case", tag = "type")]
pub enum PrivatePayload {
    YourHoleCards { hole_cards: Vec<WsCard> },
    Analytics { analytics: AnalyticsPayload },
}

// === Connection / GameRoom (kept for reference, but actual logic is in actor.rs) ===

struct Connection {
    #[allow(dead_code)]
    user_id: UserId,
    #[allow(dead_code)]
    display_name: String,
    tx: mpsc::UnboundedSender<axum::extract::ws::Message>,
    seat_index: Option<usize>,
    chip_stack: ChipAmount,
}

pub struct GameRoom {
    pub table_id: TableId,
    max_players: u8,
    small_blind: u64,
    big_blind: u64,
    connections: HashMap<UserId, Connection>,
    game_state: Option<sb_game_engine::game_state::GameState>,
    dealer_index: usize,
    broadcast_tx: BroadcastSender,
}

impl GameRoom {
    pub fn new(table_id: TableId, small_blind: u64, big_blind: u64) -> Self {
        Self {
            table_id,
            max_players: 5,
            small_blind,
            big_blind,
            connections: HashMap::new(),
            game_state: None,
            dealer_index: 0,
            broadcast_tx: broadcast_channel(256),
        }
    }

    pub fn connect(
        &mut self,
        user_id: UserId,
        display_name: String,
        tx: mpsc::UnboundedSender<axum::extract::ws::Message>,
    ) {
        self.connections.insert(
            user_id,
            Connection {
                user_id,
                display_name,
                tx,
                seat_index: None,
                chip_stack: ChipAmount::default(),
            },
        );
    }

    pub fn disconnect(&mut self, _user_id: &UserId) {}

    pub fn seat_player(&mut self, user_id: UserId, buy_in: u64) -> Result<(), String> {
        let seat = self.connections.len() % self.max_players as usize;
        let conn = self
            .connections
            .get_mut(&user_id)
            .ok_or("Player not connected")?;
        conn.seat_index = Some(seat);
        conn.chip_stack = ChipAmount::new(buy_in as i64).unwrap_or(ChipAmount::default());
        Ok(())
    }

    pub fn subscribe(&self) -> tokio::sync::broadcast::Receiver<RoomMessage> {
        self.broadcast_tx.subscribe()
    }

    pub fn apply_action(
        &mut self,
        user_id: UserId,
        action: &str,
        amount: Option<u64>,
    ) -> Result<(), String> {
        use sb_game_engine::game_state::Action;

        let parsed_action = match action {
            "fold" => Action::Fold,
            "check" => Action::Check,
            "call" => Action::Call,
            "raise" => {
                let amt = amount.ok_or("Raise requires amount")?;
                Action::Raise(ChipAmount::new(amt as i64).ok_or("Invalid raise amount")?)
            }
            "allin" => {
                let conn = self
                    .connections
                    .get(&user_id)
                    .ok_or("Player not connected")?;
                let stack = conn.chip_stack;
                Action::Raise(stack)
            }
            _ => return Err(format!("Unknown action: {}", action)),
        };

        let _ = self
            .broadcast_tx
            .send(RoomMessage::ActionBroadcast(ActionBroadcast {
                player_id: user_id,
                action: action.to_string(),
                amount,
                new_stack: 0,
                new_pot: 0,
            }));

        let _ = parsed_action;
        Ok(())
    }

    pub fn start_hand(&mut self) -> Result<(), String> {
        use sb_game_engine::game_state::GameState;

        let sb = ChipAmount::new(self.small_blind as i64).unwrap();
        let bb = ChipAmount::new(self.big_blind as i64).unwrap();

        let players: Vec<(sb_shared_types::PlayerId, ChipAmount)> = self
            .connections
            .iter()
            .filter_map(|(uid, conn)| {
                conn.seat_index.map(|_| {
                    (
                        sb_shared_types::PlayerId::new(uid.as_uuid()),
                        conn.chip_stack,
                    )
                })
            })
            .collect();

        if players.len() < 2 {
            return Err("Need at least 2 players".to_string());
        }

        self.game_state = Some(
            GameState::new_hand(self.table_id, players, self.dealer_index, (sb, bb))
                .map_err(|e| e.to_string())?,
        );

        self.broadcast_table_state();
        Ok(())
    }

    fn broadcast_table_state(&self) {
        let msg = RoomMessage::TableState(TableStateUpdate {
            table_id: self.table_id,
            players: vec![],
            current_hand_in_progress: self.game_state.is_some(),
            community_cards: vec![],
            current_turn_user_id: None,
            current_turn_expires_at: None,
            current_turn_timeout_ms: None,
            street: String::new(),
            pot: 0,
            side_pots: vec![],
        });
        let json = serde_json::to_string(&msg).unwrap_or_default();
        for conn in self.connections.values() {
            let _ = conn
                .tx
                .send(axum::extract::ws::Message::Text(json.clone().into()));
        }
    }
}

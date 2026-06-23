use sb_shared_types::{ChipAmount, TableId, UserId};
use serde::Serialize;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize)]
pub struct WsCard { pub suit: String, pub rank: String }

#[derive(Debug, Clone, Serialize)]
pub struct SidePotMessage { pub amount: u64, pub eligible_players: Vec<UserId> }

#[derive(Debug, Clone, Serialize)]
pub struct ActionInfo { pub text: String, pub amount: Option<u64> }

#[derive(Debug, Clone, Serialize)]
pub struct PlayerStateInfo {
    pub user_id: UserId, pub display_name: String, pub seat: u8,
    pub stack: ChipAmount, pub current_bet: ChipAmount,
    pub is_all_in: bool, pub is_folded: bool, pub is_leaving: bool,
    pub sitting_out: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub position_badge: Option<String>,
    pub last_action: Option<ActionInfo>,
    pub stats: Option<sb_shared_types::player_stats::PlayerStatsDto>,
}

#[derive(Debug, Clone, Serialize)]
pub struct TableStateUpdate {
    pub room_id: TableId, pub players: Vec<PlayerStateInfo>,
    pub current_hand_in_progress: bool, pub community_cards: Vec<WsCard>,
    pub current_turn_user_id: Option<UserId>,
    pub current_turn_expires_at: Option<u64>,
    pub current_turn_timeout_ms: Option<u64>,
    pub street: String, pub pot: u64, pub side_pots: Vec<SidePotMessage>,
}

#[derive(Debug, Clone, Serialize)]
pub struct AnalyticsPayload { pub win_prob: u8, pub pot_odds: f32, pub best_hand: String, pub strength: u8 }

#[derive(Debug, Clone, Serialize)]
pub struct ActionRequired {
    pub room_id: TableId, pub player_id: UserId, pub expires_at: u64,
    pub timeout_ms: u64, pub to_call: u64, pub min_raise: u64,
    pub can_check: bool, pub pot: u64,
}

#[derive(Debug, Clone, Serialize)]
pub struct ActionBroadcast {
    pub room_id: TableId, pub player_id: UserId,
    pub action: String, pub amount: Option<u64>,
    pub new_stack: u64, pub new_pot: u64,
}

#[derive(Debug, Clone, Serialize)]
pub struct ShowdownPlayer {
    pub user_id: UserId, pub display_name: String, pub seat: u8,
    pub hole_cards: Vec<WsCard>, pub hand_description: String,
    pub is_winner: bool, pub win_amount: u64, pub winning_cards: Vec<WsCard>,
}

#[derive(Debug, Clone, Serialize)]
pub struct ShowdownReveal {
    pub room_id: TableId, pub players: Vec<ShowdownPlayer>,
    pub community_cards: Vec<WsCard>, pub pot: u64,
}

#[derive(Debug, Clone, Serialize)]
pub struct WinnerResult { pub user_id: UserId, pub display_name: String, pub amount: u64, pub hand_rank: String }

#[derive(Debug, Clone, Serialize)]
pub struct HandResult { pub room_id: TableId, pub winners: Vec<WinnerResult>, pub pot: u64 }

#[derive(Debug, Clone, Serialize)]
pub enum RoomMessage {
    #[serde(rename = "TableState")] TableState(TableStateUpdate),
    #[serde(rename = "ActionRequired")] ActionRequired(ActionRequired),
    #[serde(rename = "ActionBroadcast")] ActionBroadcast(ActionBroadcast),
    #[serde(rename = "ShowdownReveal")] ShowdownReveal(ShowdownReveal),
    #[serde(rename = "HandResult")] HandResult(HandResult),
    #[serde(rename = "Error")] Error { room_id: Option<TableId>, target_user_id: Option<UserId>, message: String },
    #[serde(rename = "Connected")] Connected { room_id: TableId, user_id: UserId, seat_index: u8 },
    #[serde(rename = "PrivateMessage")] PrivateMessage { room_id: TableId, target_user_id: UserId, payload: PrivatePayload },
    #[serde(rename = "RoomAssigned")] RoomAssigned { table_id: TableId, room_id: TableId },
    KickVoteStarted { room_id: TableId, initiator_id: UserId, target_id: UserId, kick_vote_id: Uuid, duration_secs: u32, required_votes: u32 },
    KickVoteUpdate { room_id: TableId, kick_vote_id: Uuid, yes_votes: u32, required_votes: u32, passed: bool },
    PlayerRemoved { room_id: TableId, player_id: UserId, reason: String },
}

#[derive(Debug, Clone, Serialize)]
pub enum PrivatePayload {
    #[serde(rename = "your_hole_cards")] YourHoleCards { hole_cards: Vec<WsCard> },
    #[serde(rename = "analytics")] Analytics { analytics: AnalyticsPayload },
}

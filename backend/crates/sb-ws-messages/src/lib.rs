//! DEPRECATED USE TABLE-REGISTRY MESSAGES
//! WebSocket message types shared between frontend and backend.

use sb_shared_types::{ChipAmount, TableId, UserId};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum ServerMessage {
    TableState(TableStateUpdate),
    ActionRequired(ActionRequired),
    HandResult(HandResult),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TableStateUpdate {
    pub table_id: TableId,
    pub players: Vec<(UserId, ChipAmount, ChipAmount, bool)>, // (user_id, stack, current_bet, is_all_in)
    pub current_hand_in_progress: bool,
    pub community_cards: Vec<Card>,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AnalyticsPayload {
    pub win_prob: u8,
    pub pot_odds: f32,
    pub best_hand: String,
    pub strength: u8,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ActionRequired {
    pub user_id: UserId,
    pub to_call: ChipAmount,
    pub min_raise: ChipAmount,
    pub can_check: bool,
    pub remaining_ms: u64,
    pub analytics: Option<AnalyticsPayload>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HandResult {
    pub table_id: TableId,
    pub winners: Vec<(UserId, ChipAmount)>,
    pub pot: ChipAmount,
    pub community_cards: Vec<Card>,
}

// Dummy Card type – replace with actual from sb-shared-types if needed
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Card {
    pub suit: String,
    pub rank: String,
}

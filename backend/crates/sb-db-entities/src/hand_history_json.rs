use sb_shared_types::{PlayerId, UserId};
use sea_orm::FromJsonQueryResult;
use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize, FromJsonQueryResult)]
pub struct HandPlayer {
    pub player_id: PlayerId,
    pub user_id: Option<UserId>,
    pub display_name: Option<String>,
    pub seat: u8,
    pub hole_cards: Option<[String; 2]>,
    pub stack_before: i64,
    pub stack_after: i64,
    pub is_dealer: bool,
    #[serde(default)]
    pub raised_preflop: bool,
    #[serde(default)]
    pub went_to_showdown: bool,
    #[serde(default)]
    pub went_allin: bool,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize, FromJsonQueryResult)]
pub struct HandPlayers {
    pub seats: Vec<HandPlayer>,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize, FromJsonQueryResult)]
pub struct HandAction {
    pub player_id: PlayerId,
    pub action_type: String,
    pub amount: Option<i64>,
    pub timestamp_ms: u64,
    pub street: String,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize, FromJsonQueryResult)]
pub struct HandActions {
    pub actions: Vec<HandAction>,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize, FromJsonQueryResult)]
pub struct HandResult {
    pub winners: Vec<Winner>,
    pub pot_distribution: Vec<PotSplit>,
    pub community_cards: Vec<String>,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub struct Winner {
    pub player_id: PlayerId,
    pub hand_rank: u16,
    pub hand_description: String,
    pub amount_won: i64,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub struct PotSplit {
    pub winner_id: PlayerId,
    pub amount: i64,
}

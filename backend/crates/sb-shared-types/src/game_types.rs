use crate::{PlayerId, chips::ChipAmount};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TableConfig {
    pub max_players: u8,
    pub stake_level: StakeLevel,
    pub variant: GameVariant,
    pub min_buy_in: ChipAmount,
    pub max_buy_in: ChipAmount,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SidePot {
    pub amount: ChipAmount,
    pub eligible_players: Vec<PlayerId>,
}
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, derive_more::Display)]
pub enum StakeLevel {
    Micro,
    Low,
    Medium,
    High,
    VeryHigh,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, derive_more::Display)]
pub enum GameVariant {
    Holdem,
    Omaha,
    OmahaHiLo,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, derive_more::Display)]
pub enum ActionType {
    Fold,
    Check,
    Call,
    Bet,
    Raise,
    AllIn,
}

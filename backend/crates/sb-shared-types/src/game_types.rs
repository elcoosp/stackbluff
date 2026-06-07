use serde::{Serialize, Deserialize};
use crate::chips::ChipAmount;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TableConfig {
    pub max_players: u8,
    pub stake_level: StakeLevel,
    pub variant: GameVariant,
    pub min_buy_in: ChipAmount,
    pub max_buy_in: ChipAmount,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum StakeLevel {
    Micro,
    Low,
    Medium,
    High,
    VeryHigh,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum GameVariant {
    Holdem,
    Omaha,
    OmahaHiLo,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum ActionType {
    Fold,
    Check,
    Call,
    Bet,
    Raise,
    AllIn,
}

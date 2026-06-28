use chrono::{NaiveDate, NaiveDateTime};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum PuzzleAction { Fold, Check, Call, Raise, AllIn }

impl std::fmt::Display for PuzzleAction {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::Fold => write!(f, "fold"), Self::Check => write!(f, "check"),
            Self::Call => write!(f, "call"), Self::Raise => write!(f, "raise"),
            Self::AllIn => write!(f, "allin"),
        }
    }
}

impl std::str::FromStr for PuzzleAction {
    type Err = String;
    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s.to_lowercase().as_str() {
            "fold" => Ok(Self::Fold), "check" => Ok(Self::Check), "call" => Ok(Self::Call),
            "raise" => Ok(Self::Raise), "allin" | "all-in" => Ok(Self::AllIn),
            _ => Err(format!("Invalid action: {}", s)),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PuzzleSubmissionRecord {
    pub user_id: Uuid,
    pub puzzle_date: NaiveDate,
    pub selected_action: PuzzleAction,
    pub is_correct: bool,
    pub submitted_at: NaiveDateTime,
}

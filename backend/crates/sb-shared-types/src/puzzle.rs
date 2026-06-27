use chrono::{NaiveDate, NaiveDateTime};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum PuzzleAction {
    Fold,
    Check,
    Call,
    Raise,
    AllIn,
}

impl std::fmt::Display for PuzzleAction {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            PuzzleAction::Fold => write!(f, "fold"),
            PuzzleAction::Check => write!(f, "check"),
            PuzzleAction::Call => write!(f, "call"),
            PuzzleAction::Raise => write!(f, "raise"),
            PuzzleAction::AllIn => write!(f, "allin"),
        }
    }
}

impl std::str::FromStr for PuzzleAction {
    type Err = String;
    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s.to_lowercase().as_str() {
            "fold" => Ok(PuzzleAction::Fold),
            "check" => Ok(PuzzleAction::Check),
            "call" => Ok(PuzzleAction::Call),
            "raise" => Ok(PuzzleAction::Raise),
            "allin" | "all-in" | "all_in" => Ok(PuzzleAction::AllIn),
            _ => Err(format!("Invalid puzzle action: {}", s)),
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

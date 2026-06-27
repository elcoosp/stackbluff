use crate::puzzle::data;
use crate::puzzle::models::{PuzzleResponse, SubmitRequest, SubmitResponse};
use chrono::Utc;
use sb_contracts::repo_api::PuzzleRepo;
use sb_shared_types::puzzle::{PuzzleAction, PuzzleSubmissionRecord};
use tracing::info;
use uuid::Uuid;
use once_cell::sync::Lazy;
use prometheus::{IntCounter, Opts, Registry};

static PUZZLE_SUBMISSIONS_TOTAL: Lazy<IntCounter> = Lazy::new(|| IntCounter::with_opts(Opts::new("puzzle_submissions_total", "Total submissions")).unwrap());
static PUZZLE_CORRECT_TOTAL: Lazy<IntCounter> = Lazy::new(|| IntCounter::with_opts(Opts::new("puzzle_correct_total", "Total correct")).unwrap());

pub fn register_metrics(registry: &Registry) {
    let _ = registry.register(Box::new(PUZZLE_SUBMISSIONS_TOTAL.clone()));
    let _ = registry.register(Box::new(PUZZLE_CORRECT_TOTAL.clone()));
}

pub fn get_today_puzzle_response() -> Option<PuzzleResponse> {
    data::get_today_puzzle().map(|p| PuzzleResponse {
        puzzle_id: p.id, hole_cards: p.hole_cards.clone(), community_cards: p.community_cards.clone(),
        action_description: p.action_description.clone(), possible_actions: p.possible_actions.clone(),
    })
}

pub async fn submit_puzzle_action(user_id: Uuid, request: SubmitRequest, repo: &dyn PuzzleRepo) -> Result<SubmitResponse, PuzzleServiceError> {
    let today = data::get_today_date();
    if let Some(existing) = repo.find_submission(user_id, today).await.map_err(|e| PuzzleServiceError::DbError(e.to_string()))? {
        return Err(PuzzleServiceError::AlreadySubmitted { correct: existing.is_correct, selected_action: existing.selected_action.to_string() });
    }

    let puzzle = data::get_today_puzzle().ok_or(PuzzleServiceError::NoPuzzleAvailable)?;
    let parsed_action: PuzzleAction = request.selected_action.parse().map_err(|_| PuzzleServiceError::InvalidAction(request.selected_action.clone()))?;

    let is_valid = puzzle.possible_actions.iter().any(|a| a.to_lowercase() == parsed_action.to_string());
    if !is_valid { return Err(PuzzleServiceError::InvalidActionForPuzzle { action: parsed_action.to_string(), puzzle_id: puzzle.id }); }

    let is_correct = parsed_action.to_string() == puzzle.correct_action.to_lowercase();
    let record = PuzzleSubmissionRecord { user_id, puzzle_date: today, selected_action: parsed_action, is_correct, submitted_at: Utc::now().naive_utc() };

    repo.save_submission(record).await.map_err(|e| PuzzleServiceError::DbError(e.to_string()))?;
    PUZZLE_SUBMISSIONS_TOTAL.inc();
    if is_correct { PUZZLE_CORRECT_TOTAL.inc(); }

    info!(user_id = %user_id, puzzle_id = puzzle.id, is_correct = is_correct, "Puzzle submission recorded");
    Ok(SubmitResponse { correct: is_correct, explanation: puzzle.explanation.clone(), user_action: parsed_action.to_string(), correct_action: puzzle.correct_action.clone() })
}

#[derive(Debug, thiserror::Error)]
pub enum PuzzleServiceError {
    #[error("Already submitted")] AlreadySubmitted { correct: bool, selected_action: String },
    #[error("No puzzle available")] NoPuzzleAvailable,
    #[error("Invalid action format: {0}")] InvalidAction(String),
    #[error("Action '{action}' invalid for puzzle {puzzle_id}")] InvalidActionForPuzzle { action: String, puzzle_id: u32 },
    #[error("DB error: {0}")] DbError(String),
}

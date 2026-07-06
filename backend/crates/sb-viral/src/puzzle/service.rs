use crate::puzzle::data;
use crate::puzzle::models::{PuzzleResponse, SubmitRequest, SubmitResponse};
use chrono::Utc;
use sb_contracts::puzzle_repo::PuzzleRepo;
use sb_shared_types::puzzle::{PuzzleAction, PuzzleSubmissionRecord};
use tracing::info;
use uuid::Uuid;
use once_cell::sync::Lazy;
use prometheus::{IntCounter, Opts, Registry};

static SUBMISSIONS: Lazy<IntCounter> = Lazy::new(|| IntCounter::with_opts(Opts::new("puzzle_submissions_total", "Total")).unwrap());
static CORRECT: Lazy<IntCounter> = Lazy::new(|| IntCounter::with_opts(Opts::new("puzzle_correct_total", "Correct")).unwrap());

pub fn register_metrics(registry: &Registry) {
    let _ = registry.register(Box::new(SUBMISSIONS.clone()));
    let _ = registry.register(Box::new(CORRECT.clone()));
}

pub fn get_today_puzzle_response() -> Option<PuzzleResponse> {
    data::get_today_puzzle().map(|p| PuzzleResponse {
        puzzle_id: p.id, hole_cards: p.hole_cards.clone(), community_cards: p.community_cards.clone(),
        action_description: p.action_description.clone(), possible_actions: p.possible_actions.clone(),
    })
}

pub async fn submit_puzzle_action(user_id: Uuid, req: SubmitRequest, repo: &dyn PuzzleRepo) -> Result<SubmitResponse, PuzzleServiceError> {
    let today = data::get_today_date();
    if let Some(ex) = repo.find_submission(user_id, today).await.map_err(|e| PuzzleServiceError::Db(e.to_string()))? {
        return Err(PuzzleServiceError::AlreadySubmitted { correct: ex.is_correct, action: ex.selected_action.to_string() });
    }

    let puzzle = data::get_today_puzzle().ok_or(PuzzleServiceError::NoPuzzle)?;
    let action: PuzzleAction = req.selected_action.parse().map_err(|_| PuzzleServiceError::InvalidAction)?;

    if !puzzle.possible_actions.iter().any(|a| a.to_lowercase() == action.to_string()) {
        return Err(PuzzleServiceError::InvalidAction);
    }

    let is_correct = action.to_string() == puzzle.correct_action.to_lowercase();
    let record = PuzzleSubmissionRecord { user_id, puzzle_date: today, selected_action: action, is_correct, submitted_at: Utc::now().naive_utc() };

    repo.save_submission(record).await.map_err(|e| PuzzleServiceError::Db(e.to_string()))?;
    SUBMISSIONS.inc();
    if is_correct { CORRECT.inc(); }

    info!(user_id = %user_id, puzzle_id = puzzle.id, is_correct, "Puzzle submitted");
    Ok(SubmitResponse { correct: is_correct, explanation: puzzle.explanation.clone(), user_action: action.to_string(), correct_action: puzzle.correct_action.clone() })
}

#[derive(Debug, thiserror::Error)]
pub enum PuzzleServiceError {
    #[error("Already submitted")] AlreadySubmitted { correct: bool, action: String },
    #[error("No puzzle")] NoPuzzle,
    #[error("Invalid action")] InvalidAction,
    #[error("DB: {0}")] Db(String),
}

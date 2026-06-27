use crate::puzzle::data;
use crate::puzzle::models::{PuzzleResponse, SubmitRequest, SubmitResponse};
use chrono::Utc;
use sb_contracts::repo_api::PuzzleRepo;
use sb_db_entities::puzzle_submission;
use sea_orm::DatabaseConnection;
use tracing::{info, warn};
use uuid::Uuid;

// Prometheus metrics
use once_cell::sync::Lazy;
use prometheus::{IntCounter, Opts};

static PUZZLE_SUBMISSIONS_TOTAL: Lazy<IntCounter> = Lazy::new(|| {
    IntCounter::with_opts(Opts::new(
        "puzzle_submissions_total",
        "Total number of puzzle submissions",
    ))
    .expect("metric can be created")
});

static PUZZLE_CORRECT_TOTAL: Lazy<IntCounter> = Lazy::new(|| {
    IntCounter::with_opts(Opts::new(
        "puzzle_correct_total",
        "Total number of correct puzzle submissions",
    ))
    .expect("metric can be created")
});

pub fn register_metrics(registry: &prometheus::Registry) {
    registry.register(Box::new(PUZZLE_SUBMISSIONS_TOTAL.clone())).ok();
    registry.register(Box::new(PUZZLE_CORRECT_TOTAL.clone())).ok();
}

pub fn get_today_puzzle_response() -> Option<PuzzleResponse> {
    data::get_today_puzzle().map(|p| PuzzleResponse {
        puzzle_id: p.id,
        hole_cards: p.hole_cards.clone(),
        community_cards: p.community_cards.clone(),
        action_description: p.action_description.clone(),
        possible_actions: p.possible_actions.clone(),
    })
}

pub async fn submit_puzzle_action(
    user_id: Uuid,
    request: SubmitRequest,
    db: &DatabaseConnection,
    repo: &dyn PuzzleRepo,
) -> Result<SubmitResponse, PuzzleServiceError> {
    let today = data::get_today_date();

    // Check if already submitted
    let existing = repo
        .find_submission(db, user_id, today)
        .await
        .map_err(PuzzleServiceError::DbError)?;

    if let Some(existing_submission) = existing {
        return Err(PuzzleServiceError::AlreadySubmitted {
            correct: existing_submission.is_correct,
            selected_action: existing_submission.selected_action,
        });
    }

    // Get today's puzzle
    let puzzle = data::get_today_puzzle().ok_or(PuzzleServiceError::NoPuzzleAvailable)?;

    let is_correct = request.selected_action.to_lowercase() == puzzle.correct_action.to_lowercase();

    // Save submission
    let submission = puzzle_submission::ActiveModel {
        user_id: sea_orm::ActiveValue::Set(user_id),
        puzzle_date: sea_orm::ActiveValue::Set(today),
        selected_action: sea_orm::ActiveValue::Set(request.selected_action.clone()),
        is_correct: sea_orm::ActiveValue::Set(is_correct),
        submitted_at: sea_orm::ActiveValue::Set(Utc::now().naive_utc()),
    };

    repo.save_submission(db, submission)
        .await
        .map_err(PuzzleServiceError::DbError)?;

    // Update metrics
    PUZZLE_SUBMISSIONS_TOTAL.inc();
    if is_correct {
        PUZZLE_CORRECT_TOTAL.inc();
    }

    info!(
        user_id = %user_id,
        puzzle_id = puzzle.id,
        is_correct = is_correct,
        "Puzzle submission recorded"
    );

    Ok(SubmitResponse {
        correct: is_correct,
        explanation: puzzle.explanation.clone(),
        user_action: request.selected_action,
        correct_action: puzzle.correct_action.clone(),
    })
}

#[derive(Debug, thiserror::Error)]
pub enum PuzzleServiceError {
    #[error("You already submitted today's puzzle")]
    AlreadySubmitted {
        correct: bool,
        selected_action: String,
    },
    #[error("No puzzle available for today")]
    NoPuzzleAvailable,
    #[error("Database error: {0}")]
    DbError(String),
}

impl From<sb_contracts::persistence_error::PersistenceError> for PuzzleServiceError {
    fn from(e: sb_contracts::persistence_error::PersistenceError) -> Self {
        PuzzleServiceError::DbError(e.to_string())
    }
}

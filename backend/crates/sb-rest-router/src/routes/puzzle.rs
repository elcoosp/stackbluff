use axum::{extract::State, http::StatusCode, response::IntoResponse, Json, Extension};
use sb_contracts::repo_api::PuzzleRepo;
use sb_shared_types::request_context::RequestContext;
use sb_viral::puzzle::models::{SubmitRequest, SubmitResponse};
use sb_viral::puzzle::service;
use serde_json::json;
use std::sync::Arc;

pub struct AppState { pub puzzle_repo: Arc<dyn PuzzleRepo> }

pub async fn get_today_puzzle() -> impl IntoResponse {
    match service::get_today_puzzle_response() {
        Some(puzzle) => (StatusCode::OK, Json(json!(puzzle))).into_response(),
        None => (StatusCode::NOT_FOUND, Json(json!({"error": "No puzzle available"}))).into_response(),
    }
}

pub async fn submit_puzzle(
    Extension(ctx): Extension<RequestContext>,
    State(state): State<Arc<AppState>>,
    Json(request): Json<SubmitRequest>,
) -> impl IntoResponse {
    let user_id = ctx.user_id;
    match service::submit_puzzle_action(user_id, request, state.puzzle_repo.as_ref()).await {
        Ok(response) => (StatusCode::OK, Json(json!(response))).into_response(),
        Err(service::PuzzleServiceError::AlreadySubmitted { correct, selected_action }) =>
            (StatusCode::CONFLICT, Json(json!({"error": "Already submitted", "correct": correct, "selected_action": selected_action}))).into_response(),
        Err(service::PuzzleServiceError::InvalidAction(_)) | Err(service::PuzzleServiceError::InvalidActionForPuzzle { .. }) =>
            (StatusCode::BAD_REQUEST, Json(json!({"error": "Invalid action submitted"}))).into_response(),
        Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": e.to_string()}))).into_response(),
    }
}

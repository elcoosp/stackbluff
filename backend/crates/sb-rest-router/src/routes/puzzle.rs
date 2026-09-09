use axum::{
    Json, Router,
    extract::{Extension, State},
    http::StatusCode,
    response::IntoResponse,
    routing::{get, post},
};
use sb_shared_types::request_context::RequestContext;
use sb_viral::puzzle::models::SubmitRequest;
use sb_viral::puzzle::service;
use serde_json::json;
use std::sync::Arc;

use crate::AppState;

pub async fn get_today_puzzle() -> impl IntoResponse {
    match service::get_today_puzzle_response() {
        Some(p) => (StatusCode::OK, Json(json!(p))).into_response(),
        None => (StatusCode::NOT_FOUND, Json(json!({"error": "No puzzle"}))).into_response(),
    }
}

pub async fn submit_puzzle(
    Extension(ctx): Extension<RequestContext>,
    State(state): State<Arc<AppState>>,
    Json(req): Json<SubmitRequest>,
) -> impl IntoResponse {
    let user_id = match ctx.user_id {
        Some(uid) => uid.0,
        None => {
            return (
                StatusCode::UNAUTHORIZED,
                Json(json!({"error": "Auth required"})),
            )
                .into_response();
        }
    };

    match service::submit_puzzle_action(user_id, req, state.puzzle_repo.as_ref()).await {
        Ok(res) => (StatusCode::OK, Json(json!(res))).into_response(),
        Err(service::PuzzleServiceError::AlreadySubmitted { correct, action }) => (
            StatusCode::CONFLICT,
            Json(json!({"error": "Already submitted", "correct": correct, "action": action})),
        )
            .into_response(),
        Err(service::PuzzleServiceError::InvalidAction) => (
            StatusCode::BAD_REQUEST,
            Json(json!({"error": "Invalid action"})),
        )
            .into_response(),
        Err(e) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({"error": e.to_string()})),
        )
            .into_response(),
    }
}

pub fn router() -> Router<Arc<AppState>> {
    Router::new()
        .route("/puzzle/today", get(get_today_puzzle))
        .route("/puzzle/submit", post(submit_puzzle))
}

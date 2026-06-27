use axum::Json;
use axum::extract::{Query, State};
use axum::http::StatusCode;
use axum::response::IntoResponse;
use serde::Deserialize;
use std::sync::Arc;

#[derive(Debug, Deserialize)]
pub struct LeaderboardParams {
    pub offset: Option<u64>,
}

pub async fn get_global_leaderboard(
    State(state): State<Arc<crate::AppState>>,
    Query(params): Query<LeaderboardParams>,
) -> impl IntoResponse {
    let offset = params.offset.unwrap_or(0);
    let limit = 100;
    match state
        .leaderboard_query
        .get_global_leaderboard(offset, limit)
        .await
    {
        Ok(entries) => Json(entries).into_response(),
        Err(e) => {
            tracing::error!("Leaderboard query failed: {:?}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, "Internal server error").into_response()
        }
    }
}

pub fn leaderboard_routes() -> axum::Router<Arc<crate::AppState>> {
    axum::Router::new().route(
        "/leaderboard/global",
        axum::routing::get(get_global_leaderboard),
    )
}

use axum::{routing::get, routing::post, Router};

use crate::handlers::{ClubState, create_club, get_leaderboard, join_club};

/// Build the Axum router for all `/clubs` endpoints.
pub fn club_router(state: ClubState) -> Router {
    Router::new()
        .route("/clubs", post(create_club))
        .route("/clubs/{club_id}/join", post(join_club))
        .route("/clubs/{club_id}/leaderboard", get(get_leaderboard))
        .with_state(state)
}

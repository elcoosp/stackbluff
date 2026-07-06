use axum::{Router, routing::get, routing::post};

use crate::handlers::{
    ClubState, create_club, get_leaderboard, get_user_division, join_club, rebalance_divisions,
};

/// Build the Axum router for all `/clubs` endpoints.
pub fn club_router(state: ClubState) -> Router {
    Router::new()
        .route("/clubs", post(create_club))
        .route("/clubs/{club_id}/join", post(join_club))
        .route("/clubs/{club_id}/leaderboard", get(get_leaderboard))
        .route("/clubs/{club_id}/division", get(get_user_division))
        .route("/clubs/{club_id}/rebalance", post(rebalance_divisions))
        .with_state(state)
}

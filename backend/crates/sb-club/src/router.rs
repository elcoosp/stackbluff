use axum::{Router, routing::get, routing::post};

use crate::handlers::{ClubState, create_club, get_club_settings, get_leaderboard, join_club, update_club_settings, upload_banner};

/// Build the Axum router for all `/clubs` endpoints.
pub fn club_router(state: ClubState) -> Router {
    Router::new()
        .route("/clubs", post(create_club))
        .route("/clubs/{club_id}/join", post(join_club))
        .route("/clubs/{club_id}/leaderboard", get(get_leaderboard))
        .route("/clubs/{club_id}/settings", get(get_club_settings).patch(update_club_settings))
        .route("/clubs/{club_id}/banner", post(upload_banner))
        .with_state(state)
}

use axum::{Router, routing::get, routing::patch, routing::post};

use crate::handlers::{
    ClubState, create_club, get_club, get_club_settings, get_leaderboard, get_user_division,
    join_club, list_clubs, rebalance_divisions, update_club, update_club_settings, upload_banner,
};

pub fn club_router(state: ClubState) -> Router {
    Router::new()
        .route("/clubs", post(create_club))
        .route("/clubs", get(list_clubs))
        .route("/clubs/{club_id}", get(get_club))
        .route("/clubs/{club_id}", patch(update_club))
        .route("/clubs/{club_id}/join", post(join_club))
        .route("/clubs/{club_id}/leaderboard", get(get_leaderboard))
        .route(
            "/clubs/{club_id}/settings",
            get(get_club_settings).patch(update_club_settings),
        )
        .route("/clubs/{club_id}/banner", post(upload_banner))
        .route("/clubs/{club_id}/division", get(get_user_division))
        .route("/clubs/{club_id}/rebalance", post(rebalance_divisions))
        .with_state(state)
}

use axum::{
    Router,
    extract::DefaultBodyLimit,
    routing::{get, patch, post},
};
use std::sync::Arc;

use crate::handlers::{get_club_settings, update_club_settings, upload_banner};

pub fn club_router(service: Arc<dyn sb_contracts::ClubService>) -> Router {
    Router::new()
        .route("/clubs/{id}/settings", patch(update_club_settings))
        .route("/clubs/{id}/settings", get(get_club_settings))
        .route("/clubs/{id}/banner", post(upload_banner))
        .layer(DefaultBodyLimit::max(5 * 1024 * 1024))
        .with_state(service)
}

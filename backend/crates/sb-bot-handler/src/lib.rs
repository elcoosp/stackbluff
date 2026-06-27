mod commands;
mod handler;
mod types;

use axum::Router;
use std::sync::Arc;
pub use types::BotState;

pub fn attach(state: Arc<BotState>) -> Router {
    Router::new()
        .route(
            "/telegram/webhook",
            axum::routing::post(handler::telegram_webhook),
        )
        .with_state(state)
}

pub mod webhook_setup;


#[async_trait::async_trait]
impl sb_contracts::notification_api::ClubNotifier for BotState {
    async fn send_club_reminder(&self, _club_id: sb_shared_types::ClubId, _message: String) -> Result<(), sb_shared_types::errors::AppError> {
        Ok(())
    }
}

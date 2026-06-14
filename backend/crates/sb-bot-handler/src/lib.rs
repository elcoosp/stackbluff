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

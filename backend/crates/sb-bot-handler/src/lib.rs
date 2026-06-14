mod handler;
mod commands;
mod types;

pub use types::BotState;
use axum::Router;
use std::sync::Arc;

pub fn attach(state: Arc<BotState>) -> Router {
    Router::new()
        .route("/telegram/webhook", axum::routing::post(handler::telegram_webhook))
        .with_state(state)
}

pub mod webhook_setup;

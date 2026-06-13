mod handler;
mod commands;
mod types;

pub use handler::telegram_webhook;
pub use types::BotState;

use axum::Router;
use std::sync::Arc;

pub fn bot_router(state: Arc<BotState>) -> Router {
    Router::new()
        .route("/telegram/webhook", axum::routing::post(handler::telegram_webhook))
        .with_state(state)
}

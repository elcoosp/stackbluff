use crate::commands::{handle_poker_command, handle_challenge_command, handle_callback_query};
use crate::types::BotState;
use axum::{
    extract::State,
    response::IntoResponse,
    Json,
};
use serde_json::Value;
use std::sync::Arc;
use tracing::{info, error, warn};
use teloxide::types::{Update, Message, CallbackQuery};
use sb_shared_types::request_context::RequestContext;
use uuid::Uuid;

pub async fn telegram_webhook(
    State(state): State<Arc<BotState>>,
    Json(payload): Json<Value>,
) -> impl IntoResponse {
    let request_id = Uuid::new_v4();
    let ctx = RequestContext::new(request_id, None);

    let update: Update = match serde_json::from_value(payload.clone()) {
        Ok(upd) => upd,
        Err(e) => {
            error!(request_id = %request_id, "Invalid telegram update: {}", e);
            return axum::http::StatusCode::BAD_REQUEST.into_response();
        }
    };

    info!(request_id = %request_id, "Received telegram update");

    if let Some(message) = update.message() {
        if let Some(text) = message.text() {
            if text.starts_with("/poker") {
                handle_poker_command(&ctx, &state, message).await;
            } else if text.starts_with("/challenge") || text.contains("challenge @") {
                handle_challenge_command(&ctx, &state, message).await;
            }
        }
    }

    if let Some(callback) = update.callback_query() {
        handle_callback_query(&ctx, &state, callback).await;
    }

    axum::http::StatusCode::OK.into_response()
}

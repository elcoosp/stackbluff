use crate::commands::{handle_poker_command, handle_challenge_command, handle_callback_query};
use crate::types::BotState;
use axum::{
    extract::State,
    response::IntoResponse,
    Json,
};
use serde_json::Value;
use std::sync::Arc;
use tracing::{info, error, Instrument, Span};
use teloxide::types::Update;
use sb_shared_types::request_context::RequestContext;
use uuid::Uuid;

pub async fn telegram_webhook(
    State(state): State<Arc<BotState>>,
    Json(payload): Json<Value>,
) -> impl IntoResponse {
    let request_id = Uuid::new_v4();
    let span = Span::current();
    let ctx = RequestContext::new(request_id, None);

    let update: Update = match serde_json::from_value(payload.clone()) {
        Ok(upd) => upd,
        Err(e) => {
            error!(request_id = %request_id, error = %e, "Invalid telegram update");
            return axum::http::StatusCode::BAD_REQUEST.into_response();
        }
    };

    info!(request_id = %request_id, "Received telegram update");

    if let Some(message) = update.message() {
        if let Some(text) = message.text() {
            if text.starts_with("/poker") {
                tokio::spawn(handle_poker_command(&ctx, &state, message).instrument(span.clone()));
            } else if text.starts_with("/challenge") || text.contains("challenge @") {
                tokio::spawn(handle_challenge_command(&ctx, &state, message).instrument(span.clone()));
            }
        }
    }

    if let Some(callback) = update.callback_query() {
        tokio::spawn(handle_callback_query(&ctx, &state, callback).instrument(span.clone()));
    }

    axum::http::StatusCode::OK.into_response()
}

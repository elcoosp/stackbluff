use crate::commands::{handle_callback_query, handle_challenge_command, handle_poker_command};
use crate::types::BotState;
use axum::{Json, extract::State, response::IntoResponse};
use sb_shared_types::request_context::RequestContext;
use serde_json::Value;
use std::sync::Arc;
use teloxide::types::Update;
use tracing::{Instrument, Span, error, info};
use uuid::Uuid;

pub async fn telegram_webhook(
    State(state): State<Arc<BotState>>,
    headers: axum::http::HeaderMap,
    Json(payload): Json<Value>,
) -> impl IntoResponse {
    // S-6 FIX: verify the static secret token that Telegram sends on every
    // webhook call. Previously this endpoint accepted any caller, so
    // anyone who could reach /telegram/webhook could dispatch bot
    // commands on behalf of any Telegram id (create tables, issue
    // challenges, …). The token is compared in constant time and must be
    // configured via TELEGRAM_WEBHOOK_SECRET.
    if let Ok(expected) = std::env::var("TELEGRAM_WEBHOOK_SECRET") {
        if !expected.is_empty() {
            let received = headers
                .get("X-Telegram-Bot-Api-Secret-Token")
                .and_then(|v| v.to_str().ok())
                .unwrap_or("");
            if !constant_time_eq(received.as_bytes(), expected.as_bytes()) {
                tracing::warn!("S-6: rejected telegram webhook with bad secret token");
                return axum::http::StatusCode::UNAUTHORIZED.into_response();
            }
        } else {
            tracing::warn!(
                "S-6: TELEGRAM_WEBHOOK_SECRET is empty — webhook is UNVERIFIED"
            );
        }
    } else {
        tracing::warn!(
            "S-6: TELEGRAM_WEBHOOK_SECRET is unset — webhook is UNVERIFIED"
        );
    }

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

    match update.kind {
        teloxide::types::UpdateKind::Message(message) => {
            if let Some(text) = message.text().map(|t| t.to_string()) {
                if text.starts_with("/poker") {
                    let ctx = ctx.clone();
                    let state = state.clone();
                    tokio::spawn(
                        async move {
                            handle_poker_command(&ctx, &state, &message).await;
                        }
                        .instrument(span.clone()),
                    );
                } else if text.starts_with("/challenge") || text.contains("challenge @") {
                    let ctx = ctx.clone();
                    let state = state.clone();
                    tokio::spawn(
                        async move {
                            handle_challenge_command(&ctx, &state, &message).await;
                        }
                        .instrument(span.clone()),
                    );
                }
            }
        }
        teloxide::types::UpdateKind::CallbackQuery(callback) => {
            let ctx = ctx.clone();
            let state = state.clone();
            tokio::spawn(
                async move {
                    handle_callback_query(&ctx, &state, &callback).await;
                }
                .instrument(span.clone()),
            );
        }
        _ => {}
    }

    axum::http::StatusCode::OK.into_response()
}


/// S-6 helper: constant-time byte slice comparison.
fn constant_time_eq(a: &[u8], b: &[u8]) -> bool {
    if a.len() != b.len() { return false; }
    let mut diff: u8 = 0;
    for (x, y) in a.iter().zip(b.iter()) { diff |= x ^ y; }
    diff == 0
}

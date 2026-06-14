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

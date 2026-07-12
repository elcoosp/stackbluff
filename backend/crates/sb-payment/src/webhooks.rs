use crate::metrics;
use crate::service::RealPaymentService;
use axum::{Json, extract::State, http::StatusCode, response::IntoResponse};
use hmac::KeyInit;
use sb_contracts::service_api::PaymentService;
use sb_shared_types::{ChipAmount, UserId};
use serde_json::{Value, json};
use stripe_webhook::{Event, EventObject, Webhook};
use tracing::{error, info, warn};
use uuid::Uuid;

/// Stripe amounts are in cents; we convert back to chips (1 chip = 1 cent).
const CENT_TO_CHIP_DIVISOR: i64 = 100;

pub async fn stripe_webhook(
    State(state): State<RealPaymentService>,
    headers: axum::http::HeaderMap,
    body: String,
) -> impl IntoResponse {
    let request_id = Uuid::new_v4();
    let secret = match std::env::var("STRIPE_WEBHOOK_SECRET") {
        Ok(s) => s,
        Err(_) => {
            error!(request_id = %request_id, "STRIPE_WEBHOOK_SECRET not set");
            metrics::record_webhook_failure();
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                "Server configuration error",
            )
                .into_response();
        }
    };
    let sig_header = match headers
        .get("stripe-signature")
        .and_then(|v| v.to_str().ok())
    {
        Some(s) => s,
        None => {
            warn!(request_id = %request_id, "Missing stripe-signature header");
            metrics::record_webhook_failure();
            return (StatusCode::BAD_REQUEST, "Missing stripe-signature").into_response();
        }
    };
    let event: Event = match Webhook::construct_event(&body, sig_header, &secret) {
        Ok(e) => e,
        Err(e) => {
            error!(request_id = %request_id, error = %e, "Invalid webhook signature");
            metrics::record_webhook_failure();
            return (StatusCode::BAD_REQUEST, "Invalid signature").into_response();
        }
    };
    info!(request_id = %request_id, event_type = %event.type_, "Received Stripe webhook");
    if let EventObject::CheckoutSessionCompleted(session) = event.data.object {
        let payment_id = session.id.clone();
        let metadata = match session.metadata {
            Some(map) => map,
            None => {
                error!(request_id = %request_id, payment_id = %payment_id, "No metadata in session");
                metrics::record_webhook_failure();
                return (StatusCode::BAD_REQUEST, "Missing metadata").into_response();
            }
        };
        let user_id_str = match metadata.get("user_id") {
            Some(v) => v,
            None => {
                error!(request_id = %request_id, payment_id = %payment_id, "No user_id in metadata");
                metrics::record_webhook_failure();
                return (StatusCode::BAD_REQUEST, "Missing user_id").into_response();
            }
        };
        let user_uuid = match Uuid::parse_str(user_id_str) {
            Ok(u) => u,
            Err(_) => {
                error!(request_id = %request_id, payment_id = %payment_id, user_id = %user_id_str, "Invalid user_id UUID");
                metrics::record_webhook_failure();
                return (StatusCode::BAD_REQUEST, "Invalid user_id").into_response();
            }
        };
        let user_id = UserId::new(user_uuid);
        let amount_cents = session.amount_total.unwrap_or(0);
        // Convert cents back to chips
        let chips = amount_cents / CENT_TO_CHIP_DIVISOR;
        let start = std::time::Instant::now();
        if let Err(e) = state
            .confirm_payment(&payment_id, "stripe", "succeeded", Some(chrono::Utc::now()))
            .await
        {
            error!(request_id = %request_id, payment_id = %payment_id, error = %e, "Failed to confirm payment");
            metrics::record_webhook_failure();
            return (StatusCode::INTERNAL_SERVER_ERROR, "Internal error").into_response();
        }
        metrics::record_confirmation_duration("stripe", start.elapsed());
        if let Err(e) = state
            .award_chips_on_success(user_id, ChipAmount::new(chips).unwrap_or_default())
            .await
        {
            error!(request_id = %request_id, payment_id = %payment_id, user_id = %user_id.as_uuid(), error = %e, "Failed to award chips");
        } else {
            info!(request_id = %request_id, payment_id = %payment_id, user_id = %user_id.as_uuid(), cents = amount_cents, chips = chips, "Chips awarded successfully");
        }

        // Handle entitlements (season_pass / club_pro)
        let product_type = metadata.get("product_type").map(|s| s.as_str());
        let duration_days = metadata.get("duration_days").and_then(|s| s.parse::<i64>().ok()).unwrap_or(0);
        if let Some(ptype) = product_type {
            match ptype {
                "season_pass" => {
                    if let Err(e) = state.user_service.extend_season_pass(user_id, duration_days).await {
                        error!(request_id = %request_id, user_id = %user_id.as_uuid(), error = %e, "Failed to extend season pass");
                    } else {
                        info!(request_id = %request_id, user_id = %user_id.as_uuid(), duration_days, "Season pass extended");
                    }
                }
                "club_pro" => {
                    if let Err(e) = state.user_service.extend_club_pro(user_id, duration_days).await {
                        error!(request_id = %request_id, user_id = %user_id.as_uuid(), error = %e, "Failed to extend club pro");
                    } else {
                        info!(request_id = %request_id, user_id = %user_id.as_uuid(), duration_days, "Club pro extended");
                    }
                }
                _ => {}
            }
        }
        metrics::record_webhook_success();
    }
    (StatusCode::OK, Json(json!({ "status": "ok" }))).into_response()
}

pub async fn telegram_stars_webhook(
    State(state): State<RealPaymentService>,
    headers: axum::http::HeaderMap,
    body: String,
) -> impl IntoResponse {
    let request_id = Uuid::new_v4();
    use hmac::{Hmac, Mac};
    use sha2::Sha256;
    type HmacSha256 = Hmac<Sha256>;

    let bot_token = match std::env::var("TELEGRAM_BOT_TOKEN") {
        Ok(t) => t,
        Err(_) => {
            error!(request_id = %request_id, "TELEGRAM_BOT_TOKEN not set");
            metrics::record_webhook_failure();
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                "Server configuration error",
            )
                .into_response();
        }
    };
    let mut mac = HmacSha256::new_from_slice(bot_token.as_bytes()).unwrap();
    mac.update(body.as_bytes());
    let computed = hex::encode(mac.finalize().into_bytes());
    let received = headers
        .get("X-Telegram-Bot-Api-Signature")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("");
    if !constant_time_eq(computed.as_bytes(), received.as_bytes()) {
        warn!(request_id = %request_id, "Invalid Telegram HMAC signature");
        metrics::record_webhook_failure();
        return (StatusCode::BAD_REQUEST, "Invalid HMAC").into_response();
    }
    let update: Value = match serde_json::from_str(&body) {
        Ok(u) => u,
        Err(e) => {
            error!(request_id = %request_id, error = %e, "Invalid JSON payload");
            metrics::record_webhook_failure();
            return (StatusCode::BAD_REQUEST, "Invalid JSON").into_response();
        }
    };
    if let Some(pre_checkout) = update.get("pre_checkout_query") {
        let payment_id = pre_checkout["id"].as_str().unwrap_or("");
        let metadata = pre_checkout.get("metadata").and_then(|m| m.as_object());
        let user_id_str = metadata
            .and_then(|m| m.get("user_id"))
            .and_then(|v| v.as_str())
            .unwrap_or("");
        let user_uuid = match Uuid::parse_str(user_id_str) {
            Ok(u) => u,
            Err(_) => {
                error!(request_id = %request_id, payment_id = %payment_id, user_id = %user_id_str, "Invalid user_id UUID from Telegram");
                metrics::record_webhook_failure();
                return (StatusCode::BAD_REQUEST, "Invalid user_id").into_response();
            }
        };
        let user_id = UserId::new(user_uuid);
        let stars = pre_checkout["total_amount"].as_i64().unwrap_or(0);
        // Assume 1 star = 1 chip (or could use a configurable ratio)
        let chips = stars;
        let start = std::time::Instant::now();
        if let Err(e) = state
            .confirm_payment(
                payment_id,
                "telegram_stars",
                "succeeded",
                Some(chrono::Utc::now()),
            )
            .await
        {
            error!(request_id = %request_id, payment_id = %payment_id, error = %e, "Failed to confirm Telegram payment");
            metrics::record_webhook_failure();
            return (StatusCode::INTERNAL_SERVER_ERROR, "Internal error").into_response();
        }
        metrics::record_confirmation_duration("telegram", start.elapsed());
        if let Err(e) = state
            .award_chips_on_success(user_id, ChipAmount::new(chips).unwrap_or_default())
            .await
        {
            error!(request_id = %request_id, payment_id = %payment_id, user_id = %user_id.as_uuid(), error = %e, "Failed to award chips from Telegram");
        } else {
            info!(request_id = %request_id, payment_id = %payment_id, user_id = %user_id.as_uuid(), stars = stars, chips = chips, "Telegram chips awarded");
        }

        // Handle entitlements (season_pass / club_pro)
        let metadata_obj = pre_checkout.get("metadata").and_then(|m| m.as_object());
        let product_type = metadata_obj.and_then(|m| m.get("product_type")).and_then(|v| v.as_str());
        let duration_days = metadata_obj.and_then(|m| m.get("duration_days")).and_then(|v| v.as_i64()).unwrap_or(0);
        if let Some(ptype) = product_type {
            match ptype {
                "season_pass" => {
                    if let Err(e) = state.user_service.extend_season_pass(user_id, duration_days).await {
                        error!(request_id = %request_id, user_id = %user_id.as_uuid(), error = %e, "Failed to extend season pass (Telegram)");
                    } else {
                        info!(request_id = %request_id, user_id = %user_id.as_uuid(), duration_days, "Season pass extended (Telegram)");
                    }
                }
                "club_pro" => {
                    if let Err(e) = state.user_service.extend_club_pro(user_id, duration_days).await {
                        error!(request_id = %request_id, user_id = %user_id.as_uuid(), error = %e, "Failed to extend club pro (Telegram)");
                    } else {
                        info!(request_id = %request_id, user_id = %user_id.as_uuid(), duration_days, "Club pro extended (Telegram)");
                    }
                }
                _ => {}
            }
        }
        metrics::record_webhook_success();
    }
    (StatusCode::OK, "OK").into_response()
}

fn constant_time_eq(a: &[u8], b: &[u8]) -> bool {
    if a.len() != b.len() {
        return false;
    }
    a.iter().zip(b).fold(0, |acc, (x, y)| acc | (x ^ y)) == 0
}

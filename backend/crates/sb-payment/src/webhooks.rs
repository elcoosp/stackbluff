use crate::metrics;
use crate::service::RealPaymentService;
use axum::{Json, extract::State, http::StatusCode, response::IntoResponse};
use sb_contracts::service_api::PaymentService;
use sb_shared_types::{ChipAmount, UserId};
use serde_json::{Value, json};
use stripe_webhook::{Event, EventObject, Webhook};
use tracing::{error, info, warn};
use uuid::Uuid;

/// Stripe amounts are in cents; we convert back to chips (1 chip = 1 cent).
const CENT_TO_CHIP_DIVISOR: i64 = 100;

pub async fn stripe_webhook(
    // B-4 FIX: use Arc so this handler can be mounted on a sub-router via
    // `.with_state(Arc<RealPaymentService>)` from main.rs. Previously the
    // function took the bare struct, which made it impossible to merge
    // into the shared router.
    State(state): State<std::sync::Arc<RealPaymentService>>,
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

        // P-1 FIX: award the advertised chip grant from metadata, not
        // `amount_cents / 100`. Fall back to the legacy cents/100 formula
        // only when the metadata is absent (rows written before the fix).
        let amount_cents = session.amount_total.unwrap_or(0);
        let chips: i64 = metadata
            .get("chips")
            .and_then(|s| s.parse::<i64>().ok())
            .unwrap_or_else(|| amount_cents / CENT_TO_CHIP_DIVISOR);

        // P-3 FIX: idempotent confirmation. `try_mark_succeeded` returns
        // true only on the call that actually flipped pending -> succeeded,
        // so a redelivery of the same event cannot re-award chips.
        let start = std::time::Instant::now();
        let first_time = match state
            .confirm_payment_idempotent(&payment_id, Some(chrono::Utc::now()))
            .await
        {
            Ok(v) => v,
            Err(e) => {
                error!(request_id = %request_id, payment_id = %payment_id, error = %e, "Failed to confirm payment");
                metrics::record_webhook_failure();
                return (StatusCode::INTERNAL_SERVER_ERROR, "Internal error").into_response();
            }
        };
        metrics::record_confirmation_duration("stripe", start.elapsed());

        if !first_time {
            info!(request_id = %request_id, payment_id = %payment_id, "Duplicate Stripe webhook — chips already awarded, ignoring");
            metrics::record_webhook_success();
            return (StatusCode::OK, Json(json!({ "status": "ok" }))).into_response();
        }

        // Now we own the transition — award exactly once.
        let chip_amount = match ChipAmount::new(chips) {
            Some(a) => a,
            None => {
                error!(request_id = %request_id, payment_id = %payment_id, chips, "Invalid chip amount — refusing to award");
                metrics::record_webhook_failure();
                return (StatusCode::INTERNAL_SERVER_ERROR, "Invalid chip amount").into_response();
            }
        };
        if let Err(e) = state.award_chips_on_success(user_id, chip_amount).await {
            error!(request_id = %request_id, payment_id = %payment_id, user_id = %user_id.as_uuid(), error = %e, "Failed to award chips");
        } else {
            info!(request_id = %request_id, payment_id = %payment_id, user_id = %user_id.as_uuid(), cents = amount_cents, chips = chips, "Chips awarded successfully");
        }

        // Handle entitlements (season_pass / club_pro)
        let product_type = metadata.get("product_type").map(|s| s.as_str());
        let duration_days = metadata
            .get("duration_days")
            .and_then(|s| s.parse::<i64>().ok())
            .unwrap_or(0);
        if let Some(ptype) = product_type {
            match ptype {
                "season_pass" => {
                    if let Err(e) = state
                        .user_service
                        .extend_season_pass(user_id, duration_days)
                        .await
                    {
                        error!(request_id = %request_id, user_id = %user_id.as_uuid(), error = %e, "Failed to extend season pass");
                    } else {
                        info!(request_id = %request_id, user_id = %user_id.as_uuid(), duration_days, "Season pass extended");
                    }
                }
                "club_pro" => {
                    if let Err(e) = state
                        .user_service
                        .extend_club_pro(user_id, duration_days)
                        .await
                    {
                        error!(request_id = %request_id, user_id = %user_id.as_uuid(), error = %e, "Failed to extend club pro");
                    } else {
                        info!(request_id = %request_id, user_id = %user_id.as_uuid(), duration_days, "Club pro extended");
                    }
                }
                _ => {}
            }
        }
        metrics::record_webhook_success();
    } else {
        // P-5 FIX: handle the events that were previously ignored with a
        // silent 200 OK. Without these, a user could buy chips, request a
        // Stripe refund and keep the chips (free-money loop); a chargeback
        // never touched the account; an expired checkout left a "pending"
        // row forever.
        match event.data.object {
            EventObject::CheckoutSessionExpired(session) => {
                let payment_id = session.id.clone();
                if let Ok(Some(existing)) =
                    crate::db::PaymentRepo::find_by_payment_id(&state.db, &payment_id).await
                {
                    if existing.status == "pending" {
                        if let Err(e) = crate::db::PaymentRepo::update_status(
                            &state.db,
                            &payment_id,
                            "expired",
                            Some(chrono::Utc::now()),
                        )
                        .await
                        {
                            error!(request_id = %request_id, %payment_id, error = %e,
                                "Failed to expire pending payment");
                        } else {
                            info!(request_id = %request_id, %payment_id, "Pending payment expired");
                        }
                    }
                }
            }
            EventObject::ChargeRefunded(charge) => {
                // Identify the payment intent that was refunded, then claw
                // back the chip grant (stored on `payment_intents.amount` by
                // P-1). Negative chip awards floor at 0 in the DB layer.
                let intent_id = charge
                    .payment_intent
                    .as_ref()
                    .map(|i| i.id().to_string());
                if let Some(intent_id) = intent_id {
                    if let Ok(Some(intent)) =
                        crate::db::PaymentRepo::find_by_payment_id(&state.db, &intent_id).await
                    {
                        if intent.status == "succeeded" && intent.amount > 0 {
                            let user_id = UserId::new(intent.user_id);
                            if let Err(e) = state
                                .user_service
                                .award_chips(
                                    user_id,
                                    ChipAmount::new(-intent.amount).unwrap_or_default(),
                                )
                                .await
                            {
                                error!(request_id = %request_id, %intent_id, %user_id, error = %e,
                                    "charge.refunded: failed to claw back chips");
                            } else {
                                info!(request_id = %request_id, %intent_id, %user_id,
                                    chips = intent.amount, "charge.refunded: chips clawed back");
                            }
                            let _ = crate::db::PaymentRepo::update_status(
                                &state.db,
                                &intent_id,
                                "refunded",
                                Some(chrono::Utc::now()),
                            )
                            .await;
                        }
                    }
                }
            }
            EventObject::ChargeDisputeCreated(dispute) => {
                if let Some(intent_id) =
                    dispute.payment_intent.as_ref().map(|i| i.id().to_string())
                {
                    error!(request_id = %request_id, %intent_id,
                        "charge.dispute.created: manual review required");
                    let _ = crate::db::PaymentRepo::update_status(
                        &state.db,
                        &intent_id,
                        "disputed",
                        Some(chrono::Utc::now()),
                    )
                    .await;
                }
            }
            other => {
                // Never silently 200 an event we do not understand.
                info!(request_id = %request_id, event_type = %event.type_,
                    object = ?other, "Unhandled Stripe event (logged)");
            }
        }
        metrics::record_webhook_success();
    }
    (StatusCode::OK, Json(json!({ "status": "ok" }))).into_response()
}

pub async fn telegram_stars_webhook(
    State(state): State<std::sync::Arc<RealPaymentService>>,
    headers: axum::http::HeaderMap,
    body: String,
) -> impl IntoResponse {
    // P-2 FIX: complete rewrite to match the actual Telegram Bot API spec.
    //
    // The previous implementation:
    //   * verified a body HMAC against a header Telegram never sends
    //     (X-Telegram-Bot-Api-Signature) — every genuine request 400'd;
    //   * parsed the merchant payload from `metadata` instead of
    //     `invoice_payload` — always failed;
    //   * awarded chips on pre_checkout_query (i.e. before payment) and
    //     never called answerPreCheckoutQuery — even a forged request
    //     paid nothing and got chips.
    //
    // We now implement the real flow:
    //   1. Verify the static secret token header.
    //   2. On `pre_checkout_query`, validate the invoice_payload (which we
    //      put in the invoice when creating it) and answer within 8s.
    //   3. On `successful_payment`, confirm idempotently and award.
    let request_id = Uuid::new_v4();

    // 1) Static secret token — constant-time compare.
    let expected = state.telegram_webhook_secret();
    if !expected.is_empty() {
        let received = headers
            .get("X-Telegram-Bot-Api-Secret-Token")
            .and_then(|v| v.to_str().ok())
            .unwrap_or("");
        if !constant_time_eq(received.as_bytes(), expected.as_bytes()) {
            warn!(request_id = %request_id, "Invalid Telegram secret token");
            metrics::record_webhook_failure();
            return (StatusCode::UNAUTHORIZED, "Invalid secret token").into_response();
        }
    } else {
        warn!(request_id = %request_id, "TELEGRAM_WEBHOOK_SECRET is empty — webhook is UNVERIFIED");
    }

    let update: Value = match serde_json::from_str(&body) {
        Ok(u) => u,
        Err(e) => {
            error!(request_id = %request_id, error = %e, "Invalid JSON payload");
            metrics::record_webhook_failure();
            return (StatusCode::BAD_REQUEST, "Invalid JSON").into_response();
        }
    };

    // 2) pre_checkout_query: validate, answer within 8s.
    if let Some(q) = update.get("pre_checkout_query") {
        let query_id = q["id"].as_str().unwrap_or("").to_string();
        let payload = q["invoice_payload"].as_str().unwrap_or("");
        let parsed = parse_invoice_payload(payload);

        let ok = match parsed {
            Some((user_id, _product_id, chips, _kind)) => {
                // Look up the pending record we created when the user
                // initiated the purchase. Match on the synthetic id we
                // stored under `payment_id`.
                let synthetic = format!("tg_{}_{}", user_id.as_uuid(), chips);
                match crate::db::PaymentRepo::find_by_payment_id(&state.db, &synthetic).await {
                    Ok(Some(existing)) => existing.status == "pending",
                    _ => false,
                }
            }
            None => false,
        };

        let body = serde_json::json!({
            "pre_checkout_query_id": query_id,
            "ok": ok,
            "error_message": if ok { "" } else { "Purchase could not be validated" },
        });
        if let Err(e) = state.call_bot_api("answerPreCheckoutQuery", &body).await {
            error!(request_id = %request_id, query_id, error = %e,
                "answerPreCheckoutQuery failed");
            metrics::record_webhook_failure();
            return (StatusCode::INTERNAL_SERVER_ERROR, "Internal error").into_response();
        }
        metrics::record_webhook_success();
        return (StatusCode::OK, "OK").into_response();
    }

    // 3) successful_payment inside a message.
    if let Some(msg) = update.get("message")
        && let Some(sp) = msg.get("successful_payment")
    {
        let payload = sp["invoice_payload"].as_str().unwrap_or("");
        let telegram_charge_id = sp["telegram_payment_charge_id"].as_str().unwrap_or("");
        let (user_id, _product_id, chips, product_type) = match parse_invoice_payload(payload) {
            Some(v) => v,
            None => {
                warn!(request_id = %request_id, %telegram_charge_id,
                    "successful_payment with unparseable invoice_payload");
                metrics::record_webhook_failure();
                return (StatusCode::BAD_REQUEST, "Invalid payload").into_response();
            }
        };

        // Idempotency key is the Telegram charge id — the same message can
        // be retried by Telegram until we return 2xx.
        let payment_id = format!("tg_charge_{}", telegram_charge_id);
        let first_time = match state
            .confirm_payment_idempotent(&payment_id, Some(chrono::Utc::now()))
            .await
        {
            Ok(v) => v,
            Err(e) => {
                error!(request_id = %request_id, %payment_id, error = %e,
                    "Failed to confirm Telegram Stars payment");
                metrics::record_webhook_failure();
                return (StatusCode::INTERNAL_SERVER_ERROR, "Internal error").into_response();
            }
        };

        if !first_time {
            info!(request_id = %request_id, %payment_id,
                "Duplicate Telegram Stars webhook — ignoring");
            metrics::record_webhook_success();
            return (StatusCode::OK, "OK").into_response();
        }

        // Award chips from the payload, not the raw Stars total, so our
        // advertised grant is authoritative.
        if chips > 0 {
            let chip_amount = ChipAmount::new(chips).unwrap_or_default();
            if let Err(e) = state.award_chips_on_success(user_id, chip_amount).await {
                error!(request_id = %request_id, %payment_id, error = %e,
                    "Failed to award chips from Telegram Stars");
            } else {
                info!(request_id = %request_id, %payment_id, user_id = %user_id.as_uuid(),
                    chips, "Telegram Stars chips awarded");
            }
        }

        // Entitlements.
        match product_type.as_deref() {
            Some("season_pass") => {
                let _ = state.user_service.extend_season_pass(user_id, 30).await;
            }
            Some("club_pro") => {
                let _ = state.user_service.extend_club_pro(user_id, 30).await;
            }
            _ => {}
        }

        metrics::record_webhook_success();
        return (StatusCode::OK, "OK").into_response();
    }

    // Unrecognized update kind — log and 200 so Telegram stops retrying.
    info!(request_id = %request_id, "Unhandled Telegram update (logged)");
    (StatusCode::OK, "OK").into_response()
}

/// P-2: parse the invoice payload we set at creation time.
/// Format (created by `create_product_purchase`): we currently store
/// `<user_id>|<product_id>|<chips>|<product_type>` but fall back to the
/// legacy `<user_id>` shape for pre-existing rows.
fn parse_invoice_payload(payload: &str) -> Option<(UserId, String, i64, Option<String>)> {
    let parts: Vec<&str> = payload.split('|').collect();
    if parts.is_empty() || parts[0].is_empty() {
        return None;
    }
    let user_id = Uuid::parse_str(parts[0]).ok()?;
    let user_id = UserId::new(user_id);
    let product_id = parts.get(1).unwrap_or(&"").to_string();
    let chips: i64 = parts
        .get(2)
        .and_then(|s| s.parse::<i64>().ok())
        .unwrap_or(0);
    let product_type = parts.get(3).and_then(|s| {
        if s.is_empty() { None } else { Some(s.to_string()) }
    });
    Some((user_id, product_id, chips, product_type))
}

fn constant_time_eq(a: &[u8], b: &[u8]) -> bool {
    if a.len() != b.len() {
        return false;
    }
    a.iter().zip(b).fold(0, |acc, (x, y)| acc | (x ^ y)) == 0
}

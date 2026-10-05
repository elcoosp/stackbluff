use axum::{Extension, Json, Router, extract::State, http::StatusCode, routing::post};
use sb_auth::middleware::AuthUser;
use sb_shared_types::{RequestContext, UserId};
use serde::Deserialize;
use std::sync::Arc;

use sb_anti_cheat::FingerprintRepository;
use sb_contracts::service_api::AntiCheatService;

pub struct AntiCheatState {
    pub fingerprint_repo: Arc<dyn FingerprintRepository>,
    /// B-11 FIX: the engine was fully implemented but never instantiated —
    /// no caller could invoke `check_transfer`, `record_heads_up` or the
    /// rate checks because there was no service handle. We now hold the
    /// service here so downstream paths (chip transfers, table pairing)
    /// can call it once they are wired in follow-ups.
    pub service: Arc<dyn AntiCheatService + Send + Sync>,
}

#[derive(Deserialize)]
pub struct FingerprintPayload {
    pub fingerprint_hash: String,
}

pub fn router(state: Arc<AntiCheatState>) -> Router {
    Router::new()
        .route("/anti-cheat/fingerprint", post(record_fingerprint))
        .with_state(state)
}

pub async fn record_fingerprint(
    State(state): State<Arc<AntiCheatState>>,
    Extension(auth_user): Extension<AuthUser>,
    Extension(ctx): Extension<RequestContext>,
    Json(payload): Json<FingerprintPayload>,
) -> Result<StatusCode, (StatusCode, String)> {
    let user_id = match uuid::Uuid::parse_str(&auth_user.user_id) {
        Ok(uid) => UserId::new(uid),
        Err(_) => return Err((StatusCode::BAD_REQUEST, "Invalid user ID".to_string())),
    };

    // B-11 FIX: normalize and validate the client-supplied fingerprint.
    // The previous version stored whatever string arrived, so a client
    // could rotate an arbitrary value per login and defeat device linking
    // by design. We now require a hex string (matching the shape produced
    // by the frontend's SHA-256 helper) between 32 and 128 chars.
    let hash = payload.fingerprint_hash.trim();
    if hash.len() < 32
        || hash.len() > 128
        || !hash.chars().all(|c| c.is_ascii_hexdigit())
    {
        return Err((
            StatusCode::BAD_REQUEST,
            "Invalid fingerprint_hash format".to_string(),
        ));
    }
    let normalized_hash = hash.to_ascii_lowercase();

    state
        .fingerprint_repo
        .upsert(user_id, normalized_hash, ctx.ip)
        .await
        .map_err(|e| {
            tracing::error!("Failed to save fingerprint: {}", e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                "Failed to save fingerprint".to_string(),
            )
        })?;

    Ok(StatusCode::OK)
}

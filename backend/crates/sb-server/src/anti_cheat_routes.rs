use axum::{
    Extension, Json, Router,
    extract::State,
    http::StatusCode,
    routing::post,
};
use serde::Deserialize;
use sb_auth::middleware::AuthUser;
use sb_shared_types::{RequestContext, UserId};
use std::sync::Arc;

use sb_anti_cheat::FingerprintRepository;

pub struct AntiCheatState {
    pub fingerprint_repo: Arc<dyn FingerprintRepository>,
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

    state
        .fingerprint_repo
        .upsert(user_id, payload.fingerprint_hash, ctx.ip)
        .await
        .map_err(|e| {
            (StatusCode::INTERNAL_SERVER_ERROR, format!("Failed to save fingerprint: {}", e))
        })?;

    Ok(StatusCode::OK)
}

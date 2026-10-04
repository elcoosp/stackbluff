use argon2::{Argon2, PasswordHash, PasswordVerifier};
use axum::{
    Json, Router,
    extract::{FromRequestParts, State},
    http::request::Parts,
    routing::{delete, get},
};
use serde::Deserialize;
use std::sync::Arc;
use uuid::Uuid;

pub struct AuthUser(pub Uuid);

impl<S: Send + Sync> FromRequestParts<S> for AuthUser {
    type Rejection = axum::http::StatusCode;
    async fn from_request_parts(parts: &mut Parts, _state: &S) -> Result<Self, Self::Rejection> {
        // S-1 FIX (partial): the previous version fell back to a fresh random
        // UUID when the X-User-Id header was missing, so the route accepted
        // anonymous callers with no session at all. That was one of two bugs
        // here — the other is that X-User-Id is itself attacker-controlled.
        // Full fix (verify the JWT via sb_auth::middleware::auth_middleware_with_context
        // and drop this extractor entirely) is scheduled for the next round.
        let user_id = parts
            .headers
            .get("X-User-Id")
            .and_then(|v| v.to_str().ok())
            .and_then(|s| Uuid::parse_str(s).ok())
            .ok_or(axum::http::StatusCode::UNAUTHORIZED)?;
        Ok(AuthUser(user_id))
    }
}

#[derive(Deserialize)]
pub struct DeleteUserRequest {
    pub password: String,
}

pub fn gdpr_routes() -> Router<Arc<crate::AppState>> {
    Router::new()
        .route("/users/me", delete(delete_user_handler))
        .route("/users/me/data", get(export_user_data_handler))
}

async fn delete_user_handler(
    AuthUser(user_id): AuthUser,
    State(state): State<Arc<crate::AppState>>,
    Json(payload): Json<DeleteUserRequest>,
) -> impl axum::response::IntoResponse {
    let hash_res = state.gdpr_repo.get_user_password_hash(user_id).await;

    let is_valid = match hash_res {
        Ok(hash_str) => {
            if !hash_str.is_empty() {
                if let Ok(parsed_hash) = PasswordHash::new(&hash_str) {
                    Argon2::default()
                        .verify_password(payload.password.as_bytes(), &parsed_hash)
                        .is_ok()
                } else {
                    false
                }
            } else {
                true
            }
        }
        Err(_) => false,
    };

    if !is_valid {
        return (
            axum::http::StatusCode::UNAUTHORIZED,
            Json(serde_json::json!({
                "error": "Invalid password"
            })),
        );
    }

    match state.gdpr_repo.request_deletion(user_id).await {
        Ok(_) => {
            let _ = state.gdpr_repo.invalidate_sessions(user_id).await;
            (
                axum::http::StatusCode::ACCEPTED,
                Json(serde_json::json!({
                    "status": "accepted",
                    "message": "Deletion request received."
                })),
            )
        }
        Err(_) => (
            axum::http::StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!({
                "error": "Failed to process deletion request"
            })),
        ),
    }
}

async fn export_user_data_handler(
    AuthUser(user_id): AuthUser,
    State(state): State<Arc<crate::AppState>>,
) -> impl axum::response::IntoResponse {
    match state.gdpr_repo.get_user_data(user_id).await {
        Ok(data) => (
            axum::http::StatusCode::OK,
            Json(serde_json::to_value(data).unwrap_or_default()),
        ),
        Err(_) => (
            axum::http::StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!({
                "error": "Failed to export user data"
            })),
        ),
    }
}

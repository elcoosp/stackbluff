use argon2::{Argon2, PasswordHash, PasswordVerifier};
use axum::{
    Json, Router,
    extract::State,
    routing::{delete, get},
};
use serde::Deserialize;
use std::sync::Arc;
use uuid::Uuid;

use sb_auth::middleware::{auth_middleware_with_context, AuthUser};

#[derive(Deserialize)]
pub struct DeleteUserRequest {
    pub password: String,
}

pub fn gdpr_routes() -> Router<Arc<crate::AppState>> {
    Router::new()
        .route("/users/me", delete(delete_user_handler))
        .route("/users/me/data", get(export_user_data_handler))
        // S-1 FIX: layer the JWT auth middleware so the AuthUser extractor
        // below receives an identity derived from a *verified* token.
        //
        // Previously this module defined its own AuthUser extractor that read
        // `X-User-Id` directly from the request headers and fell back to a
        // random UUID when absent. Anyone could:
        //   * GET /users/me/data for any user id (full PII export), or
        //   * DELETE /users/me for any passwordless account (every Telegram
        //     signup, whose password hash column is empty and whose old
        //     check treated empty as "password correct").
        // Now both routes require a valid JWT; the extractor comes from
        // sb_auth::middleware::AuthUser (populated by this middleware).
        .layer(axum::middleware::from_fn(auth_middleware_with_context))
}

async fn delete_user_handler(
    AuthUser { user_id: user_id_str }: AuthUser,
    State(state): State<Arc<crate::AppState>>,
    Json(payload): Json<DeleteUserRequest>,
) -> impl axum::response::IntoResponse {
    let user_id = match Uuid::parse_str(&user_id_str) {
        Ok(u) => u,
        Err(_) => {
            return (
                axum::http::StatusCode::UNAUTHORIZED,
                Json(serde_json::json!({"error": "Invalid user id in token"})),
            );
        }
    };

    let hash_res = state.gdpr_repo.get_user_password_hash(user_id).await;

    // S-1 FIX (second bug in this handler): the old code treated an empty
    // password hash as "valid" (`else { true }`) — every Telegram-only
    // account has an empty hash, so a passwordless account could be deleted
    // by anyone. Refuse: passwordless accounts must go through an
    // alternative confirmation flow (e.g. re-auth via initData) before
    // this endpoint can act on them.
    let is_valid = match hash_res {
        Ok(hash_str) if !hash_str.is_empty() => {
            if let Ok(parsed_hash) = PasswordHash::new(&hash_str) {
                Argon2::default()
                    .verify_password(payload.password.as_bytes(), &parsed_hash)
                    .is_ok()
            } else {
                false
            }
        }
        Ok(_) => false, // passwordless account — password confirmation not applicable
        Err(_) => false,
    };

    if !is_valid {
        return (
            axum::http::StatusCode::UNAUTHORIZED,
            Json(serde_json::json!({"error": "Invalid password"})),
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
            Json(serde_json::json!({"error": "Failed to process deletion request"})),
        ),
    }
}

async fn export_user_data_handler(
    AuthUser { user_id: user_id_str }: AuthUser,
    State(state): State<Arc<crate::AppState>>,
) -> impl axum::response::IntoResponse {
    let user_id = match Uuid::parse_str(&user_id_str) {
        Ok(u) => u,
        Err(_) => {
            return (
                axum::http::StatusCode::UNAUTHORIZED,
                Json(serde_json::json!({"error": "Invalid user id in token"})),
            );
        }
    };

    match state.gdpr_repo.get_user_data(user_id).await {
        Ok(data) => (
            axum::http::StatusCode::OK,
            Json(serde_json::to_value(data).unwrap_or_default()),
        ),
        Err(_) => (
            axum::http::StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!({"error": "Failed to export user data"})),
        ),
    }
}

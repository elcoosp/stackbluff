use axum::{
    extract::State,
    http::StatusCode,
    response::IntoResponse,
    routing::post,
    Json, Router,
};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use sb_shared_types::errors::AppError;
use sb_shared_types::request_context::RequestContext;
use crate::SharedAuthService;

/// Temporary helper to build a RequestContext.
/// TODO: replace with a middleware that extracts request_id and optional user_id from headers.
fn dummy_ctx() -> RequestContext {
    // In production, request_id and user_id should come from request extensions/headers.
    RequestContext::new(Uuid::new_v4(), None)
}

fn app_error_to_status(e: &AppError) -> StatusCode {
    match e {
        AppError::InvalidInput(_) => StatusCode::BAD_REQUEST,
        AppError::NotFound(_) => StatusCode::NOT_FOUND,
        AppError::Unauthorized(_) => StatusCode::UNAUTHORIZED,
        AppError::Conflict(_) => StatusCode::CONFLICT,
        AppError::Internal(_) => StatusCode::INTERNAL_SERVER_ERROR,
        // Exhaustive – no need for catch‑all
    }
}

#[derive(Deserialize)]
struct TelegramAuthRequest { init_data: String }

#[derive(Deserialize)]
struct EmailPasswordRequest { email: String, password: String }

#[derive(Serialize)]
struct AuthResponse { jwt: String, user_id: String }

async fn telegram_auth(
    State(svc): State<SharedAuthService>,
    Json(req): Json<TelegramAuthRequest>,
) -> impl IntoResponse {
    let ctx = dummy_ctx();
    match svc.telegram_auth(&ctx, &req.init_data).await {
        Ok(r) => (StatusCode::OK, Json(AuthResponse { jwt: r.jwt, user_id: r.user_id.to_string() })).into_response(),
        Err(e) => (app_error_to_status(&e), Json(serde_json::json!({"error": e.to_string()}))).into_response(),
    }
}

async fn register(
    State(svc): State<SharedAuthService>,
    Json(req): Json<EmailPasswordRequest>,
) -> impl IntoResponse {
    let ctx = dummy_ctx();
    match svc.register(&ctx, &req.email, &req.password).await {
        Ok(r) => (StatusCode::OK, Json(AuthResponse { jwt: r.jwt, user_id: r.user_id.to_string() })).into_response(),
        Err(e) => (app_error_to_status(&e), Json(serde_json::json!({"error": e.to_string()}))).into_response(),
    }
}

async fn login(
    State(svc): State<SharedAuthService>,
    Json(req): Json<EmailPasswordRequest>,
) -> impl IntoResponse {
    let ctx = dummy_ctx();
    match svc.login(&ctx, &req.email, &req.password).await {
        Ok(r) => (StatusCode::OK, Json(AuthResponse { jwt: r.jwt, user_id: r.user_id.to_string() })).into_response(),
        Err(e) => (app_error_to_status(&e), Json(serde_json::json!({"error": e.to_string()}))).into_response(),
    }
}

pub fn auth_router(svc: SharedAuthService) -> Router {
    Router::new()
        .route("/auth/telegram", post(telegram_auth))
        .route("/auth/register", post(register))
        .route("/auth/login", post(login))
        .with_state(svc)
}

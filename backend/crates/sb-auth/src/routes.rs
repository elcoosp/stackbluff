use std::sync::Arc;

use axum::{
    extract::State,
    http::StatusCode,
    response::IntoResponse,
    routing::post,
    Json, Router,
};
use serde::{Deserialize, Serialize};

use sb_contracts::service_api::AuthService;
use sb_shared_types::request_context::RequestContext;
use crate::SharedAuthService;

#[derive(Deserialize)]
struct TelegramAuthRequest {
    init_data: String,
}

#[derive(Deserialize)]
struct EmailPasswordRequest {
    email: String,
    password: String,
}

#[derive(Serialize)]
struct AuthResponse {
    jwt: String,
    user_id: String,
}

async fn telegram_auth(
    State(svc): State<SharedAuthService>,
    Json(req): Json<TelegramAuthRequest>,
) -> impl IntoResponse {
    let ctx = RequestContext::new();
    match svc.telegram_auth(&ctx, &req.init_data).await {
        Ok(result) => (
            StatusCode::OK,
            Json(AuthResponse {
                jwt: result.jwt,
                user_id: result.user_id.to_string(),
            }),
        )
            .into_response(),
        Err(e) => {
            let code = if e.is_unauthorized() { StatusCode::UNAUTHORIZED } else { StatusCode::BAD_REQUEST };
            (code, Json(serde_json::json!({"error": e.to_string()}))).into_response()
        }
    }
}

async fn register(
    State(svc): State<SharedAuthService>,
    Json(req): Json<EmailPasswordRequest>,
) -> impl IntoResponse {
    let ctx = RequestContext::new();
    match svc.register(&ctx, &req.email, &req.password).await {
        Ok(result) => (
            StatusCode::OK,
            Json(AuthResponse {
                jwt: result.jwt,
                user_id: result.user_id.to_string(),
            }),
        )
            .into_response(),
        Err(e) => {
            let code = if e.is_unauthorized() { StatusCode::UNAUTHORIZED } else { StatusCode::BAD_REQUEST };
            (code, Json(serde_json::json!({"error": e.to_string()}))).into_response()
        }
    }
}

async fn login(
    State(svc): State<SharedAuthService>,
    Json(req): Json<EmailPasswordRequest>,
) -> impl IntoResponse {
    let ctx = RequestContext::new();
    match svc.login(&ctx, &req.email, &req.password).await {
        Ok(result) => (
            StatusCode::OK,
            Json(AuthResponse {
                jwt: result.jwt,
                user_id: result.user_id.to_string(),
            }),
        )
            .into_response(),
        Err(e) => {
            let code = if e.is_unauthorized() { StatusCode::UNAUTHORIZED } else { StatusCode::BAD_REQUEST };
            (code, Json(serde_json::json!({"error": e.to_string()}))).into_response()
        }
    }
}

pub fn auth_router(svc: SharedAuthService) -> Router {
    Router::new()
        .route("/auth/telegram", post(telegram_auth))
        .route("/auth/register", post(register))
        .route("/auth/login", post(login))
        .with_state(svc)
}

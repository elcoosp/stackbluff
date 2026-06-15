use axum::{
    Json, Router,
    extract::State,
    http::StatusCode,
    response::IntoResponse,
    routing::{get, post},
};
use serde::{Deserialize, Serialize};
use tower_cookies::{Cookie, Cookies};
use uuid::Uuid;

use crate::SharedAuthService;
use sb_shared_types::errors::AppError;
use sb_shared_types::request_context::RequestContext;

fn dummy_ctx() -> RequestContext {
    RequestContext::new(Uuid::new_v4(), None)
}

fn app_error_to_status(e: &AppError) -> StatusCode {
    match e {
        AppError::InvalidInput(_) => StatusCode::BAD_REQUEST,
        AppError::NotFound(_) => StatusCode::NOT_FOUND,
        AppError::Unauthorized(_) => StatusCode::UNAUTHORIZED,
        AppError::Conflict(_) => StatusCode::CONFLICT,
        AppError::Internal(_) => StatusCode::INTERNAL_SERVER_ERROR,
        AppError::Configuration(_) => StatusCode::INTERNAL_SERVER_ERROR,
        AppError::Database(_) => StatusCode::INTERNAL_SERVER_ERROR,
        AppError::External(_) => StatusCode::BAD_GATEWAY,
    }
}

#[derive(Deserialize)]
struct TelegramAuthRequest {
    init_data: String,
}

#[derive(Deserialize)]
struct RegisterRequest {
    username: String,
    email: String,
    password: String,
}

#[derive(Deserialize)]
struct EmailPasswordRequest {
    email: String,
    password: String,
}

#[derive(Serialize)]
struct AuthUserResponse {
    id: String,
}

#[derive(Serialize)]
struct AuthResponse {
    token: String,
    user: AuthUserResponse,
}

/// Helper to set the auth cookie on any successful auth response.
fn set_auth_cookie(cookies: &Cookies, jwt: &str) {
    let cookie = Cookie::build(("token", jwt.to_string()))
        .path("/")
        .http_only(true)
        .secure(false) // set to true in production with HTTPS
        .same_site(tower_cookies::cookie::SameSite::Lax)
        .build();
    cookies.add(cookie);
}

fn auth_response(r: sb_contracts::service_api::AuthResult) -> impl IntoResponse {
    (
        StatusCode::OK,
        Json(AuthResponse {
            token: r.jwt,
            user: AuthUserResponse {
                id: r.user_id.to_string(),
            },
        }),
    )
}

fn error_response(e: AppError) -> axum::response::Response {
    (
        app_error_to_status(&e),
        Json(serde_json::json!({"error": e.to_string()})),
    )
        .into_response()
}

async fn telegram_auth(
    cookies: Cookies,
    State(svc): State<SharedAuthService>,
    Json(req): Json<TelegramAuthRequest>,
) -> impl IntoResponse {
    let ctx = dummy_ctx();
    match svc.telegram_auth(&ctx, &req.init_data).await {
        Ok(r) => {
            set_auth_cookie(&cookies, &r.jwt);
            auth_response(r).into_response()
        }
        Err(e) => error_response(e),
    }
}

async fn register(
    cookies: Cookies,
    State(svc): State<SharedAuthService>,
    Json(req): Json<RegisterRequest>,
) -> impl IntoResponse {
    let ctx = dummy_ctx();
    match svc
        .register(&ctx, &req.username, &req.email, &req.password)
        .await
    {
        Ok(r) => {
            set_auth_cookie(&cookies, &r.jwt);
            auth_response(r).into_response()
        }
        Err(e) => error_response(e),
    }
}

async fn login(
    cookies: Cookies,
    State(svc): State<SharedAuthService>,
    Json(req): Json<EmailPasswordRequest>,
) -> impl IntoResponse {
    let ctx = dummy_ctx();
    match svc.login(&ctx, &req.email, &req.password).await {
        Ok(r) => {
            set_auth_cookie(&cookies, &r.jwt);
            auth_response(r).into_response()
        }
        Err(e) => error_response(e),
    }
}

async fn me() -> impl IntoResponse {
    (
        StatusCode::OK,
        Json(serde_json::json!({
            "id": "demo",
            "username": "Demo User",
            "email": "demo@stackbluff.com",
            "chip_balance": 100000
        })),
    )
}

pub fn auth_router(svc: SharedAuthService) -> Router {
    Router::new()
        .route("/auth/telegram", post(telegram_auth))
        .route("/auth/register", post(register))
        .route("/auth/login", post(login))
        .route("/auth/me", get(me))
        .with_state(svc)
}

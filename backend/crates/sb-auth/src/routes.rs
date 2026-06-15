use axum::{Json, Router, extract::State, http::StatusCode, response::IntoResponse, routing::post};
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

// Updated: Added username field for registration
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
struct AuthUser {
    id: String,
}

#[derive(Serialize)]
struct AuthResponse {
    token: String,
    user: AuthUser,
}

async fn telegram_auth(
    State(svc): State<SharedAuthService>,
    Json(req): Json<TelegramAuthRequest>,
) -> impl IntoResponse {
    let ctx = dummy_ctx();
    match svc.telegram_auth(&ctx, &req.init_data).await {
        Ok(r) => (
            StatusCode::OK,
            Json(AuthResponse {
                token: r.jwt,
                user: AuthUser {
                    id: r.user_id.to_string(),
                },
            }),
        )
            .into_response(),
        Err(e) => (
            app_error_to_status(&e),
            Json(serde_json::json!({"error": e.to_string()})),
        )
            .into_response(),
    }
}

// Updated: Accept RegisterRequest and pass username to service
async fn register(
    State(svc): State<SharedAuthService>,
    Json(req): Json<RegisterRequest>,
) -> impl IntoResponse {
    let ctx = dummy_ctx();
    match svc
        .register(&ctx, &req.username, &req.email, &req.password)
        .await
    {
        Ok(r) => (
            StatusCode::OK,
            Json(AuthResponse {
                token: r.jwt,
                user: AuthUser {
                    id: r.user_id.to_string(),
                },
            }),
        )
            .into_response(),
        Err(e) => (
            app_error_to_status(&e),
            Json(serde_json::json!({"error": e.to_string()})),
        )
            .into_response(),
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
            let cookie = Cookie::build(("token", r.jwt.clone()))
                .path("/")
                .http_only(true)
                .secure(false) // set to true in production with HTTPS
                .same_site(tower_cookies::cookie::SameSite::Lax)
                .build();
            cookies.add(cookie);
            (
                StatusCode::OK,
                Json(AuthResponse {
                    token: r.jwt,
                    user: AuthUser {
                        id: r.user_id.to_string(),
                    },
                }),
            )
                .into_response()
        }
        Err(e) => (
            app_error_to_status(&e),
            Json(serde_json::json!({"error": e.to_string()})),
        )
            .into_response(),
    }
}

pub fn auth_router(svc: SharedAuthService) -> Router {
    Router::new()
        .route("/auth/telegram", post(telegram_auth))
        .route("/auth/register", post(register))
        .route("/auth/login", post(login))
        .with_state(svc)
}

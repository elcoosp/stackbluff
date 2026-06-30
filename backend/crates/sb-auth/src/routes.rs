use axum::{
    Json, Router,
    extract::State,
    http::{HeaderMap, StatusCode, header},
    response::IntoResponse,
    routing::{get, post},
};
use serde::{Deserialize, Serialize};
use tower_cookies::{Cookie, Cookies};
use uuid::Uuid;

use crate::SharedAuthService;
use sb_shared_types::errors::AppError;
use sb_shared_types::request_context::RequestContext;

/// Create a request context for the current request
/// TODO: Extract from Axum middleware/extensions for proper request tracing
/// Currently creates a new UUID per request, losing correlation with upstream services
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
        AppError::TournamentFull
        | AppError::TournamentAlreadyStarted
        | AppError::TournamentRegistrationClosed
        | AppError::TournamentNotRunning
        | AppError::InvalidSeat => StatusCode::BAD_REQUEST,
        AppError::External(_) => StatusCode::BAD_GATEWAY,
        AppError::Timeout => StatusCode::GATEWAY_TIMEOUT,
        AppError::TooManyRequests(_) => StatusCode::TOO_MANY_REQUESTS,
        AppError::Forbidden(_) => StatusCode::FORBIDDEN,
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

#[derive(Deserialize)]
struct ForgotPasswordRequest {
    email: String,
}

#[derive(Deserialize)]
struct ResetPasswordRequest {
    token: String,
    new_password: String,
}

#[derive(Serialize)]
struct MessageResponse {
    message: String,
}

#[derive(Serialize)]
struct AuthUserResponse {
    id: String,
    username: String,
    email: Option<String>,
}

#[derive(Serialize)]
struct AuthResponse {
    token: String,
    user: AuthUserResponse,
    balance: i64,
}

#[derive(Serialize)]
struct MeResponse {
    id: String,
    username: String,
    email: Option<String>,
    chip_balance: i64,
}

fn set_auth_cookie(cookies: &Cookies, jwt: &str) {
    let cookie = Cookie::build(("token", jwt.to_string()))
        .path("/")
        .http_only(true)
        .secure(false)
        .same_site(tower_cookies::cookie::SameSite::Lax)
        .build();
    cookies.add(cookie);
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
            match svc.get_user_profile(&ctx, r.user_id).await {
                Ok(profile) => (
                    StatusCode::OK,
                    Json(AuthResponse {
                        token: r.jwt,
                        user: AuthUserResponse {
                            id: profile.id.to_string(),
                            username: profile.display_name,
                            email: profile.email,
                        },
                        balance: profile.chip_balance,
                    }),
                )
                    .into_response(),
                Err(e) => error_response(e),
            }
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
            match svc.get_user_profile(&ctx, r.user_id).await {
                Ok(profile) => (
                    StatusCode::OK,
                    Json(AuthResponse {
                        token: r.jwt,
                        user: AuthUserResponse {
                            id: profile.id.to_string(),
                            username: profile.display_name,
                            email: profile.email,
                        },
                        balance: profile.chip_balance,
                    }),
                )
                    .into_response(),
                Err(e) => error_response(e),
            }
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
            match svc.get_user_profile(&ctx, r.user_id).await {
                Ok(profile) => (
                    StatusCode::OK,
                    Json(AuthResponse {
                        token: r.jwt,
                        user: AuthUserResponse {
                            id: profile.id.to_string(),
                            username: profile.display_name,
                            email: profile.email,
                        },
                        balance: profile.chip_balance,
                    }),
                )
                    .into_response(),
                Err(e) => error_response(e),
            }
        }
        Err(e) => error_response(e),
    }
}

async fn me_handler(
    cookies: Cookies,
    headers: HeaderMap,
    State(svc): State<SharedAuthService>,
) -> impl IntoResponse {
    let token = cookies
        .get("token")
        .map(|c| c.value().to_string())
        .or_else(|| {
            headers
                .get(header::AUTHORIZATION)
                .and_then(|h| h.to_str().ok())
                .and_then(|h| h.strip_prefix("Bearer "))
                .map(|s| s.to_string())
        });

    let token = match token {
        Some(t) => t,
        None => {
            return error_response(AppError::Unauthorized("Missing token".to_string()));
        }
    };

    let ctx = dummy_ctx();
    match svc.validate_token(&token).await {
        Ok(user_id) => match svc.get_user_profile(&ctx, user_id).await {
            Ok(profile) => (
                StatusCode::OK,
                Json(MeResponse {
                    id: profile.id.to_string(),
                    username: profile.display_name,
                    email: profile.email,
                    chip_balance: profile.chip_balance,
                }),
            )
                .into_response(),
            Err(e) => error_response(e),
        },
        Err(e) => error_response(e),
    }
}

async fn verify_email_handler(
    axum::extract::Query(params): axum::extract::Query<VerifyEmailQuery>,
    State(svc): State<SharedAuthService>,
) -> impl IntoResponse {
    match svc.verify_email(&params.token).await {
        Ok(()) => (
            StatusCode::OK,
            Json(MessageResponse {
                message: "Email verified successfully".to_string(),
            }),
        )
            .into_response(),
        Err(e) => error_response(e),
    }
}

#[derive(Deserialize)]
struct VerifyEmailQuery {
    token: String,
}

async fn forgot_password(
    State(svc): State<SharedAuthService>,
    Json(req): Json<ForgotPasswordRequest>,
) -> impl IntoResponse {
    let ctx = dummy_ctx();
    match svc.forgot_password(&ctx, &req.email).await {
        Ok(()) => (
            StatusCode::OK,
            Json(MessageResponse {
                message: "If the email exists, a reset link has been sent".to_string(),
            }),
        )
            .into_response(),
        Err(e) => error_response(e),
    }
}

async fn reset_password(
    State(svc): State<SharedAuthService>,
    Json(req): Json<ResetPasswordRequest>,
) -> impl IntoResponse {
    match svc.reset_password(&req.token, &req.new_password).await {
        Ok(()) => (
            StatusCode::OK,
            Json(MessageResponse {
                message: "Password reset successfully".to_string(),
            }),
        )
            .into_response(),
        Err(e) => error_response(e),
    }
}

async fn resend_verification(
    cookies: Cookies,
    headers: HeaderMap,
    State(svc): State<SharedAuthService>,
) -> impl IntoResponse {
    let token = cookies
        .get("token")
        .map(|c| c.value().to_string())
        .or_else(|| {
            headers
                .get(header::AUTHORIZATION)
                .and_then(|h| h.to_str().ok())
                .and_then(|h| h.strip_prefix("Bearer "))
                .map(|s| s.to_string())
        });

    let token = match token {
        Some(t) => t,
        None => {
            return error_response(AppError::Unauthorized("Missing token".to_string()));
        }
    };

    let ctx = dummy_ctx();
    match svc.validate_token(&token).await {
        Ok(user_id) => match svc.send_verification_email(&ctx, user_id).await {
            Ok(()) => (
                StatusCode::OK,
                Json(MessageResponse {
                    message: "Verification email sent".to_string(),
                }),
            )
                .into_response(),
            Err(e) => error_response(e),
        },
        Err(e) => error_response(e),
    }
}

pub fn auth_router(svc: SharedAuthService) -> Router {
    Router::new()
        .route("/auth/telegram", post(telegram_auth))
        .route("/auth/register", post(register))
        .route("/auth/login", post(login))
        .route("/auth/me", get(me_handler))
        .route("/auth/verify-email", get(verify_email_handler))
        .route("/auth/forgot-password", post(forgot_password))
        .route("/auth/reset-password", post(reset_password))
        .route("/auth/resend-verification", post(resend_verification))
        .with_state(svc)
}

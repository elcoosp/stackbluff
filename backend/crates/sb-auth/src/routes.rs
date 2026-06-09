use axum::{
    extract::State,
    http::StatusCode,
    response::IntoResponse,
    routing::post,
    Json, Router,
};
use axum::extract::FromRequestParts;
use axum::http::request::Parts;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use sb_contracts::service_api::AuthService;
use sb_shared_types::errors::AppError;
use sb_shared_types::ids::UserId;
use sb_shared_types::request_context::RequestContext;
use crate::SharedAuthService;

/// Custom Axum extractor that builds a RequestContext.
/// In production this should be enriched by middleware that sets request_id and optional user_id.
pub struct ExtractedCtx(pub RequestContext);

#[async_trait::async_trait]
impl<S: Send + Sync> FromRequestParts<S> for ExtractedCtx {
    type Rejection = std::convert::Infallible;

    async fn from_request_parts(parts: &mut Parts, _state: &S) -> Result<Self, Self::Rejection> {
        // Attempt to retrieve request ID and user ID from extensions (set by middleware).
        let request_id = parts
            .extensions
            .get::<Uuid>()
            .copied()
            .unwrap_or_else(Uuid::new_v4);
        let user_id = parts.extensions.get::<Option<UserId>>().copied().flatten();
        Ok(ExtractedCtx(RequestContext::new(request_id, user_id)))
    }
}

fn app_error_to_status(e: &AppError) -> StatusCode {
    // Match on the enum variants defined in sb-shared-types
    match e {
        AppError::InvalidInput(_) => StatusCode::BAD_REQUEST,
        AppError::NotFound(_) => StatusCode::NOT_FOUND,
        AppError::Unauthorized(_) => StatusCode::UNAUTHORIZED,
        AppError::Conflict(_) => StatusCode::CONFLICT,
        AppError::Internal(_) => StatusCode::INTERNAL_SERVER_ERROR,
        // Fallback (should never happen, but exhaustive)
        _ => StatusCode::INTERNAL_SERVER_ERROR,
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
    ExtractedCtx(ctx): ExtractedCtx,
    Json(req): Json<TelegramAuthRequest>,
) -> impl IntoResponse {
    match svc.telegram_auth(&ctx, &req.init_data).await {
        Ok(r) => (StatusCode::OK, Json(AuthResponse { jwt: r.jwt, user_id: r.user_id.to_string() })).into_response(),
        Err(e) => (app_error_to_status(&e), Json(serde_json::json!({"error": e.to_string()}))).into_response(),
    }
}

async fn register(
    State(svc): State<SharedAuthService>,
    ExtractedCtx(ctx): ExtractedCtx,
    Json(req): Json<EmailPasswordRequest>,
) -> impl IntoResponse {
    match svc.register(&ctx, &req.email, &req.password).await {
        Ok(r) => (StatusCode::OK, Json(AuthResponse { jwt: r.jwt, user_id: r.user_id.to_string() })).into_response(),
        Err(e) => (app_error_to_status(&e), Json(serde_json::json!({"error": e.to_string()}))).into_response(),
    }
}

async fn login(
    State(svc): State<SharedAuthService>,
    ExtractedCtx(ctx): ExtractedCtx,
    Json(req): Json<EmailPasswordRequest>,
) -> impl IntoResponse {
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

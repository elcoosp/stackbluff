use axum::{
    extract::{ConnectInfo, Request},
    http::StatusCode,
    middleware::Next,
    response::{IntoResponse, Response},
};
use jsonwebtoken::{DecodingKey, Validation, decode};
use once_cell::sync::Lazy;
use serde::{Deserialize, Serialize};
use std::env;
use std::net::SocketAddr;
use tower_cookies::Cookies;
use uuid::Uuid;

use sb_shared_types::{RequestContext, UserId};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Claims {
    pub sub: String,
    pub exp: usize,
}

#[derive(Debug, Clone)]
pub struct AuthUser {
    pub user_id: String,
}

static DECODING_KEY: Lazy<DecodingKey> = Lazy::new(|| {
    let secret = env::var("JWT_SECRET").unwrap_or_else(|_| "your-secret-key".to_string());
    DecodingKey::from_secret(secret.as_bytes())
});

/// Authentication middleware that also creates a RequestContext.
pub async fn auth_middleware_with_context(mut req: Request, next: Next) -> Response {
    // Try to get token from Authorization header first
    let token = req
        .headers()
        .get("Authorization")
        .and_then(|h| h.to_str().ok())
        .and_then(|h| h.strip_prefix("Bearer "))
        .map(|t| t.to_string());

    // If not found, try to get from cookie
    let token = if let Some(t) = token {
        Some(t)
    } else {
        req.extensions()
            .get::<Cookies>()
            .and_then(|cookies| cookies.get("token").map(|c| c.value().to_string()))
    };

    // If still no token, return 401
    let token = match token {
        Some(t) => t,
        None => {
            return (StatusCode::UNAUTHORIZED, "Missing token").into_response();
        }
    };

    // Validate token
    let decoding_key = DECODING_KEY.clone();
    let validation = Validation::default();
    let token_data = match decode::<Claims>(&token, &decoding_key, &validation) {
        Ok(data) => data,
        Err(e) => {
            tracing::warn!(error = %e, "Token validation failed");
            return (StatusCode::UNAUTHORIZED, "Invalid token").into_response();
        }
    };

    // Parse user ID
    let user_id = match Uuid::parse_str(&token_data.claims.sub) {
        Ok(uid) => UserId::new(uid),
        Err(e) => {
            tracing::warn!(error = %e, "Invalid user ID in token");
            return (StatusCode::UNAUTHORIZED, "Invalid token").into_response();
        }
    };

    // Extract client IP from ConnectInfo
    let ip = req
        .extensions()
        .get::<ConnectInfo<SocketAddr>>()
        .map(|addr| addr.ip().to_string())
        .unwrap_or_else(|| "unknown".to_string());

    // Create RequestContext
    let request_id = Uuid::new_v4();
    let ctx = RequestContext {
        request_id,
        user_id: Some(user_id),
        ip,
    };

    // Insert both AuthUser and RequestContext into extensions
    let auth_user = AuthUser {
        user_id: token_data.claims.sub,
    };
    req.extensions_mut().insert(auth_user);
    req.extensions_mut().insert(ctx);

    next.run(req).await
}

impl<S> axum::extract::FromRequestParts<S> for AuthUser
where
    S: Send + Sync,
{
    type Rejection = (StatusCode, &'static str);
    async fn from_request_parts(
        parts: &mut axum::http::request::Parts,
        _state: &S,
    ) -> Result<Self, Self::Rejection> {
        parts
            .extensions
            .get::<AuthUser>()
            .cloned()
            .ok_or((StatusCode::UNAUTHORIZED, "Not authenticated"))
    }
}

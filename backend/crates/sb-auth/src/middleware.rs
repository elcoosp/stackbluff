use axum::{
    extract::{ConnectInfo, Request},
    http::StatusCode,
    middleware::Next,
    response::{IntoResponse, Response},
};
use std::net::SocketAddr;
use tower_cookies::Cookies;
use uuid::Uuid;

use sb_shared_types::{RequestContext, UserId};

use crate::SharedAuthService;

#[derive(Debug, Clone)]
pub struct AuthUser {
    pub user_id: String,
}

/// Authentication middleware that uses injected SharedAuthService.
pub async fn auth_middleware_with_context(
    mut req: Request,
    next: Next,
) -> Response {
    // Extract the auth service from request extensions (injected by the router).
    let auth_service = match req.extensions().get::<SharedAuthService>() {
        Some(s) => s.clone(),
        None => {
            tracing::error!("SharedAuthService not found in request extensions");
            return (StatusCode::INTERNAL_SERVER_ERROR, "Service unavailable").into_response();
        }
    };

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

    // Validate token using the auth service's config.
    // We need to get the JWT secret from the service.
    // We'll add a method to get the secret or just use the existing verify_jwt with the secret.
    // But we need to access the secret. We'll store it in the service.
    // For simplicity, we'll just use the existing verify_jwt with a static secret? No, we must use the service's config.
    // Since we already have the service, we can call its verify_token method.
    // But verify_token returns TokenClaims, not the raw Claims.
    // We'll use the service's verify_token which already checks expiration and signature.
    let claims = match auth_service.verify_token(&token).await {
        Ok(c) => c,
        Err(e) => {
            tracing::warn!(error = %e, "Token validation failed");
            return (StatusCode::UNAUTHORIZED, "Invalid token").into_response();
        }
    };

    // Parse user ID
    let user_id = match Uuid::parse_str(&claims.user_id.0.to_string()) {
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
        user_id: claims.user_id.0.to_string(),
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

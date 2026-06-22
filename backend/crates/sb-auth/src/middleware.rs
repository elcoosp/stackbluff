use axum::{
    extract::Request,
    http::StatusCode,
    middleware::Next,
    response::{IntoResponse, Response},
};
use jsonwebtoken::{DecodingKey, Validation, decode};
use once_cell::sync::Lazy;
use serde::{Deserialize, Serialize};
use std::env;
use tower_cookies::Cookies;

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

pub async fn auth_middleware(mut req: Request, next: Next) -> Response {
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

    let token = match token {
        Some(t) => t,
        None => {
            return (StatusCode::UNAUTHORIZED, "Missing token").into_response();
        }
    };

    let decoding_key = DECODING_KEY.clone();
    let validation = Validation::default();
    let token_data = match decode::<Claims>(&token, &decoding_key, &validation) {
        Ok(data) => data,
        Err(e) => {
            eprintln!("Token validation error: {:?}", e);
            return (StatusCode::UNAUTHORIZED, "Invalid token").into_response();
        }
    };

    let auth_user = AuthUser {
        user_id: token_data.claims.sub,
    };
    req.extensions_mut().insert(auth_user);
    next.run(req).await
}

impl<S> axum::extract::FromRequest<S> for AuthUser
where
    S: Send + Sync,
{
    type Rejection = (StatusCode, &'static str);
    async fn from_request(
        req: axum::extract::Request,
        _state: &S,
    ) -> Result<Self, Self::Rejection> {
        req.extensions()
            .get::<AuthUser>()
            .cloned()
            .ok_or((StatusCode::UNAUTHORIZED, "Not authenticated"))
    }
}

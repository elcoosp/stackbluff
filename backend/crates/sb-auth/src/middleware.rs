use axum::{
    extract::Request,
    http::StatusCode,
    middleware::Next,
    response::{IntoResponse, Response},
};
use jsonwebtoken::{DecodingKey, Validation, decode};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Claims {
    pub sub: String,
    pub exp: usize,
}

#[derive(Debug, Clone)]
pub struct AuthUser {
    pub user_id: String,
}

pub async fn auth_middleware(mut req: Request, next: Next) -> Result<Response, impl IntoResponse> {
    let auth_header = req
        .headers()
        .get("Authorization")
        .and_then(|h| h.to_str().ok());

    let token = match auth_header {
        Some(t) if t.starts_with("Bearer ") => &t[7..],
        _ => {
            return Err((
                StatusCode::UNAUTHORIZED,
                "Missing or invalid Authorization header",
            ));
        }
    };

    let decoding_key = DecodingKey::from_secret(b"your-secret-key");
    let validation = Validation::default();
    let token_data = decode::<Claims>(token, &decoding_key, &validation)
        .map_err(|_| (StatusCode::UNAUTHORIZED, "Invalid token"))?;

    let auth_user = AuthUser {
        user_id: token_data.claims.sub,
    };
    req.extensions_mut().insert(auth_user);
    Ok(next.run(req).await)
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

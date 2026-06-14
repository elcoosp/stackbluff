use axum::{
    extract::ConnectInfo,
    http::{Request, StatusCode},
    middleware::Next,
    response::Response,
};
use std::net::SocketAddr;
use sb_anti_cheat::rate_limiter::RateLimiter;
use once_cell::sync::Lazy;

static RATE_LIMITER: Lazy<RateLimiter> = Lazy::new(RateLimiter::new);

pub async fn rate_limit_middleware<B>(req: Request<B>, next: Next<B>) -> Result<Response, StatusCode> {
    let ip = req
        .extensions()
        .get::<ConnectInfo<SocketAddr>>()
        .map(|addr| addr.ip().to_string())
        .unwrap_or_else(|| "unknown".to_string());

    if req.uri().path().starts_with("/api/auth") {
        if !RATE_LIMITER.check_auth_ip(&ip) {
            return Err(StatusCode::TOO_MANY_REQUESTS);
        }
    }

    if let Some(user_id) = req.headers().get("X-User-Id").and_then(|h| h.to_str().ok()) {
        if !RATE_LIMITER.check_game_action(user_id) {
            return Err(StatusCode::TOO_MANY_REQUESTS);
        }
    }

    Ok(next.run(req).await)
}

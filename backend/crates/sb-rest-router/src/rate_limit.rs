use axum::{
    extract::ConnectInfo,
    http::{Request, StatusCode},
    middleware::Next,
    response::Response,
};
use std::net::SocketAddr;
use std::sync::Arc;
use sb_anti_cheat::rate_limiter::RateLimiter;

pub async fn rate_limit_middleware(
    mut req: Request,
    next: Next,
) -> Result<Response, StatusCode> {
    // Retrieve the shared rate limiter from request extensions
    let limiter = req.extensions()
        .get::<Arc<RateLimiter>>()
        .ok_or(StatusCode::INTERNAL_SERVER_ERROR)?
        .clone();

    let ip = req
        .extensions()
        .get::<ConnectInfo<SocketAddr>>()
        .map(|addr| addr.ip().to_string())
        .unwrap_or_else(|| "unknown".to_string());

    if req.uri().path().starts_with("/api/auth") {
        if !limiter.check_auth_ip(&ip) {
            return Err(StatusCode::TOO_MANY_REQUESTS);
        }
    }

    if let Some(user_id) = req.headers().get("X-User-Id").and_then(|h| h.to_str().ok()) {
        if !limiter.check_game_action(user_id) {
            return Err(StatusCode::TOO_MANY_REQUESTS);
        }
    }

    Ok(next.run(req).await)
}

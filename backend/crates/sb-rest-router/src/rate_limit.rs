use axum::{
    extract::{ConnectInfo, Request},
    http::StatusCode,
    middleware::Next,
    response::Response,
};
use sb_anti_cheat::rate_limiter::RateLimiter;
use std::net::SocketAddr;
use std::sync::Arc;

pub async fn rate_limit_middleware(req: Request, next: Next) -> Result<Response, StatusCode> {
    // Retrieve the shared rate limiter from request extensions
    let limiter = req
        .extensions()
        .get::<Arc<RateLimiter>>()
        .ok_or(StatusCode::INTERNAL_SERVER_ERROR)?
        .clone();

    let ip = req
        .extensions()
        .get::<ConnectInfo<SocketAddr>>()
        .map(|addr| addr.ip().to_string())
        .unwrap_or_else(|| "unknown".to_string());

    if req.uri().path().starts_with("/api/auth") && !limiter.check_auth_ip(&ip) {
        return Err(StatusCode::TOO_MANY_REQUESTS);
    }

    if let Some(user_id) = req.headers().get("X-User-Id").and_then(|h| h.to_str().ok())
        && !limiter.check_game_action(user_id)
    {
        return Err(StatusCode::TOO_MANY_REQUESTS);
    }

    Ok(next.run(req).await)
}

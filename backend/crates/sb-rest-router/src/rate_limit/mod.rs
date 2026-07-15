use axum::{body::Body, extract::Request, http::StatusCode, response::Response};
use sb_anti_cheat::rate_limiter::RateLimiter;
use std::future::Future;
use std::pin::Pin;
use std::sync::OnceLock;
use std::task::{Context, Poll};
use tower::Service;

// A boxed future that can hold either the inner service's future or a ready response.
type BoxFuture<T> = Pin<Box<dyn Future<Output = T> + Send>>;

static LIMITER: OnceLock<RateLimiter> = OnceLock::new();

fn get_limiter() -> &'static RateLimiter {
    LIMITER.get_or_init(|| RateLimiter::new())
}

/// A tower service that applies rate limiting.
#[derive(Clone)]
pub struct RateLimitService<S> {
    inner: S,
}

impl<S> RateLimitService<S> {
    fn new(inner: S) -> Self {
        Self { inner }
    }
}

impl<S> Service<Request<Body>> for RateLimitService<S>
where
    S: Service<Request<Body>, Response = Response<Body>> + Clone + Send + 'static,
    S::Future: Send + 'static,
    S::Error: Send + 'static,
{
    type Response = S::Response;
    type Error = S::Error;
    type Future = BoxFuture<Result<S::Response, S::Error>>;

    fn poll_ready(&mut self, cx: &mut Context<'_>) -> Poll<Result<(), Self::Error>> {
        self.inner.poll_ready(cx)
    }

    fn call(&mut self, req: Request<Body>) -> Self::Future {
        let ip = req
            .extensions()
            .get::<axum::extract::ConnectInfo<std::net::SocketAddr>>()
            .map(|addr| addr.ip().to_string())
            .unwrap_or_else(|| "unknown".to_string());

        if !get_limiter().check_auth_ip(&ip) {
            let response = Response::builder()
                .status(StatusCode::TOO_MANY_REQUESTS)
                .body(Body::from("Too many requests"))
                .unwrap();
            // Return a ready future as a boxed future.
            Box::pin(std::future::ready(Ok(response)))
        } else {
            Box::pin(self.inner.call(req))
        }
    }
}

/// Layer that applies the rate limiter.
#[derive(Clone)]
pub struct RateLimitLayer;

impl<S> tower::Layer<S> for RateLimitLayer {
    type Service = RateLimitService<S>;

    fn layer(&self, inner: S) -> Self::Service {
        RateLimitService::new(inner)
    }
}

/// Returns a layer that applies rate limiting to all requests.
pub fn rate_limit_layer() -> RateLimitLayer {
    RateLimitLayer
}

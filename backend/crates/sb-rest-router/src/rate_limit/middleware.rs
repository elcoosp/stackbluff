use dashmap::DashMap;
use std::sync::Arc;
use std::time::{Duration, Instant};
use tower::{Layer, Service};
use tower::layer::layer_fn;

/// Simple IP-based rate limiter using a sliding window.
#[derive(Clone)]
pub struct RateLimiter {
    records: Arc<DashMap<String, (Instant, u32)>>,
    window: Duration,
    max_requests: u32,
}

impl RateLimiter {
    pub fn new(window: Duration, max_requests: u32) -> Self {
        Self {
            records: Arc::new(DashMap::new()),
            window,
            max_requests,
        }
    }

    pub fn check_and_record(&self, key: &str) -> bool {
        let now = Instant::now();
        let cutoff = now - self.window;

        let mut entry = self.records.entry(key.to_string()).or_insert_with(|| (now, 0));
        let (last_reset, count) = entry.value_mut();

        if *last_reset < cutoff {
            *last_reset = now;
            *count = 1;
            return true;
        }

        if *count >= self.max_requests {
            return false;
        }

        *count += 1;
        true
    }

    pub fn cleanup(&self) {
        let cutoff = Instant::now() - self.window;
        self.records.retain(|_, (ts, _)| *ts >= cutoff);
    }

    /// Spawn a background cleanup task.
    pub fn spawn_cleanup(self: Arc<Self>) {
        tokio::spawn(async move {
            let mut interval = tokio::time::interval(Duration::from_secs(60));
            loop {
                interval.tick().await;
                self.cleanup();
            }
        });
    }
}

/// Tower Service that applies rate limiting.
#[derive(Clone)]
pub struct RateLimitService<S> {
    inner: S,
    limiter: Arc<RateLimiter>,
}

impl<S, B> Service<axum::http::Request<B>> for RateLimitService<S>
where
    S: Service<axum::http::Request<B>, Response = axum::http::Response<axum::body::Body>>
        + Clone + Send + 'static,
    S::Error: Send + 'static,
    S::Future: Send + 'static,
    B: Send + 'static,
{
    type Response = axum::http::Response<axum::body::Body>;
    type Error = S::Error;
    type Future = std::pin::Pin<
        Box<dyn std::future::Future<Output = Result<Self::Response, Self::Error>> + Send>,
    >;

    fn poll_ready(&mut self, cx: &mut std::task::Context<'_>) -> std::task::Poll<Result<(), Self::Error>> {
        self.inner.poll_ready(cx)
    }

    fn call(&mut self, req: axum::http::Request<B>) -> Self::Future {
        let ip = req
            .extensions()
            .get::<axum::extract::ConnectInfo<std::net::SocketAddr>>()
            .map(|addr| addr.ip().to_string())
            .unwrap_or_else(|| "unknown".to_string());

        // S-2 FIX: actually return the 429. Previously we constructed a 429
        // into a `_response` local and then fell through to `self.inner.call(req)`
        // anyway, silently disabling rate limiting on every route (login,
        // password reset, fingerprint submission, …). The 40 lines of comments
        // acknowledged this and never implemented it.
        if !self.limiter.check_and_record(&ip) {
            let response = axum::http::Response::builder()
                .status(axum::http::StatusCode::TOO_MANY_REQUESTS)
                .header(axum::http::header::RETRY_AFTER, "1")
                .body(axum::body::Body::empty())
                .expect("static 429 response");
            return Box::pin(std::future::ready(Ok(response)));
        }

        Box::pin(self.inner.call(req))
    }
}

/// Layer that applies the rate limiter.
pub fn rate_limit_layer(rate: u32, window_secs: u64) -> impl Layer<axum::Router> + Clone {
    let limiter = Arc::new(RateLimiter::new(Duration::from_secs(window_secs), rate));
    limiter.clone().spawn_cleanup();
    let limiter_clone = limiter.clone();
    layer_fn(move |inner| {
        let limiter = limiter_clone.clone();
        RateLimitService { inner, limiter }
    })
}

/// Default rate limiter: 50 requests per second.
pub fn default_rate_limit_layer() -> impl Layer<axum::Router> + Clone {
    rate_limit_layer(50, 1)
}

use dashmap::DashMap;
use std::sync::Arc;
use std::time::{Duration, Instant};
use tracing::debug;

/// Rate limiter that tracks timestamps per key (e.g., email address).
/// Allows max `max_requests` within `window` duration.
#[derive(Clone)]
pub struct RateLimiter {
    records: Arc<DashMap<String, Vec<Instant>>>,
    max_requests: usize,
    window: Duration,
}

impl RateLimiter {
    pub fn new(max_requests: usize, window: Duration) -> Self {
        Self {
            records: Arc::new(DashMap::new()),
            max_requests,
            window,
        }
    }

    /// Check if the key is allowed to proceed. Returns true if allowed.
    /// Also records the current attempt.
    pub fn check_and_record(&self, key: &str) -> bool {
        let now = Instant::now();
        let cutoff = now - self.window;

        let mut entry = self.records.entry(key.to_string()).or_default();
        let timestamps = entry.value_mut();

        // Remove expired entries
        timestamps.retain(|t| *t > cutoff);

        if timestamps.len() >= self.max_requests {
            debug!(key = %key, count = timestamps.len(), "Rate limit exceeded");
            return false;
        }

        timestamps.push(now);
        true
    }

    /// Check if the key is allowed without recording.
    pub fn check(&self, key: &str) -> bool {
        let now = Instant::now();
        let cutoff = now - self.window;

        if let Some(entry) = self.records.get(key) {
            let timestamps = entry.value();
            let recent_count = timestamps.iter().filter(|t| **t > cutoff).count();
            recent_count < self.max_requests
        } else {
            true
        }
    }

    /// Clean up expired entries to prevent memory leaks.
    pub fn cleanup(&self) {
        let now = Instant::now();
        let cutoff = now - self.window;

        self.records.retain(|_, timestamps| {
            timestamps.retain(|t| *t > cutoff);
            !timestamps.is_empty()
        });
    }
}


impl RateLimiter {
    /// Spawn a background task that periodically cleans up expired entries
    pub fn spawn_cleanup(self: std::sync::Arc<Self>, interval_secs: u64) -> tokio::task::JoinHandle<()> {
        tokio::spawn(async move {
            let mut interval = tokio::time::interval(tokio::time::Duration::from_secs(interval_secs));
            loop {
                interval.tick().await;
                self.cleanup();
                tracing::debug!("Rate limiter cleanup completed");
            }
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_rate_limiter_allows_under_limit() {
        let limiter = RateLimiter::new(3, Duration::from_secs(60));
        assert!(limiter.check_and_record("test@example.com"));
        assert!(limiter.check_and_record("test@example.com"));
        assert!(limiter.check_and_record("test@example.com"));
    }

    #[test]
    fn test_rate_limiter_blocks_over_limit() {
        let limiter = RateLimiter::new(3, Duration::from_secs(60));
        assert!(limiter.check_and_record("test@example.com"));
        assert!(limiter.check_and_record("test@example.com"));
        assert!(limiter.check_and_record("test@example.com"));
        assert!(!limiter.check_and_record("test@example.com"));
    }

    #[test]
    fn test_rate_limiter_different_keys() {
        let limiter = RateLimiter::new(1, Duration::from_secs(60));
        assert!(limiter.check_and_record("a@example.com"));
        assert!(limiter.check_and_record("b@example.com"));
        assert!(!limiter.check_and_record("a@example.com"));
    }
}

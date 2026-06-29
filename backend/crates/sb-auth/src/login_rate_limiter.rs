use dashmap::DashMap;
use std::sync::Arc;
use std::time::{Duration, Instant};
use tracing::debug;

/// Rate limiter specifically for login attempts to prevent brute-force attacks
#[derive(Clone)]
pub struct LoginRateLimiter {
    failed_attempts: Arc<DashMap<String, (u32, Instant)>>,
    locked_accounts: Arc<DashMap<String, Instant>>,
    max_attempts: u32,
    lockout_duration: Duration,
    attempt_window: Duration,
}

impl LoginRateLimiter {
    pub fn new(max_attempts: u32, lockout_duration: Duration, attempt_window: Duration) -> Self {
        Self {
            failed_attempts: Arc::new(DashMap::new()),
            locked_accounts: Arc::new(DashMap::new()),
            max_attempts,
            lockout_duration,
            attempt_window,
        }
    }

    pub fn is_locked(&self, email: &str) -> bool {
        if let Some(unlock_time) = self.locked_accounts.get(email) {
            if Instant::now() < *unlock_time {
                return true;
            } else {
                drop(unlock_time);
                self.locked_accounts.remove(email);
                self.failed_attempts.remove(email);
            }
        }
        false
    }

    pub fn record_failure(&self, email: &str) -> bool {
        let now = Instant::now();
        let cutoff = now - self.attempt_window;

        let mut entry = self.failed_attempts.entry(email.to_string()).or_insert((0, now));
        let (count, first_time) = entry.value_mut();

        if *first_time < cutoff {
            *count = 0;
            *first_time = now;
        }

        *count += 1;

        if *count >= self.max_attempts {
            debug!(email = %email, attempts = *count, "Account locked");
            let unlock_time = now + self.lockout_duration;
            self.locked_accounts.insert(email.to_string(), unlock_time);
            self.failed_attempts.remove(email);
            return true;
        }

        false
    }

    pub fn record_success(&self, email: &str) {
        self.failed_attempts.remove(email);
        self.locked_accounts.remove(email);
    }
}

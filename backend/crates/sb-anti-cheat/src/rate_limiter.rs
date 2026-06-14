use dashmap::DashMap;
use chrono::{DateTime, Utc, Duration};

#[derive(Default)]
pub struct RateLimiter {
    action_count: DashMap<(String, String), Vec<DateTime<Utc>>>,
    auth_ip_count: DashMap<String, Vec<DateTime<Utc>>>,
}

impl RateLimiter {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn check_game_action(&self, user_id: &str) -> bool {
        let now = Utc::now();
        let key = (user_id.to_string(), "game_action".to_string());
        let mut timestamps = self.action_count.entry(key).or_insert_with(Vec::new);
        timestamps.retain(|&ts| now - ts <= Duration::seconds(1));
        if timestamps.len() >= 10 {
            return false;
        }
        timestamps.push(now);
        true
    }

    pub fn check_auth_ip(&self, ip: &str) -> bool {
        let now = Utc::now();
        let mut timestamps = self.auth_ip_count.entry(ip.to_string()).or_insert_with(Vec::new);
        timestamps.retain(|&ts| now - ts <= Duration::minutes(1));
        if timestamps.len() >= 100 {
            return false;
        }
        timestamps.push(now);
        true
    }
}

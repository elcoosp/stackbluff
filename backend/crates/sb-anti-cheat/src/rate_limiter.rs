use chrono::{DateTime, Duration, Utc};
use dashmap::DashMap;
use metrics;
use std::env;

#[derive(Default)]
pub struct RateLimiter {
    action_count: DashMap<(String, String), Vec<DateTime<Utc>>>,
    auth_ip_count: DashMap<String, Vec<DateTime<Utc>>>,
    game_action_limit: usize,
    auth_limit: usize,
}

impl RateLimiter {
    pub fn new() -> Self {
        let game_action_limit = env::var("GAME_ACTION_LIMIT")
            .ok()
            .and_then(|s| s.parse().ok())
            .unwrap_or(10);
        let auth_limit = env::var("AUTH_IP_LIMIT")
            .ok()
            .and_then(|s| s.parse().ok())
            .unwrap_or(100);
        Self {
            action_count: DashMap::new(),
            auth_ip_count: DashMap::new(),
            game_action_limit,
            auth_limit,
        }
    }

    pub fn check_game_action(&self, user_id: &str) -> bool {
        let now = Utc::now();
        let key = (user_id.to_string(), "game_action".to_string());
        let mut timestamps = self.action_count.entry(key).or_default();
        timestamps.retain(|&ts| ts >= now - Duration::seconds(1));
        if timestamps.len() >= self.game_action_limit {
            metrics::counter!("anti_cheat_rate_limited").increment(1);
            return false;
        }
        timestamps.push(now);
        true
    }

    pub fn check_auth_ip(&self, ip: &str) -> bool {
        let now = Utc::now();
        let mut timestamps = self.auth_ip_count.entry(ip.to_string()).or_default();
        timestamps.retain(|&ts| ts >= now - Duration::minutes(1));
        if timestamps.len() >= self.auth_limit {
            metrics::counter!("anti_cheat_rate_limited").increment(1);
            return false;
        }
        timestamps.push(now);
        true
    }

    pub fn cleanup_expired(&self) {
        let now = Utc::now();
        let action_cutoff = now - Duration::seconds(1);
        let auth_cutoff = now - Duration::minutes(1);
        self.action_count.retain(|_, timestamps| {
            timestamps.retain(|&ts| ts >= action_cutoff);
            !timestamps.is_empty()
        });
        self.auth_ip_count.retain(|_, timestamps| {
            timestamps.retain(|&ts| ts >= auth_cutoff);
            !timestamps.is_empty()
        });
    }
}

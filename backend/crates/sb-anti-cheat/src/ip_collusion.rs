use metrics;
use dashmap::DashMap;
use chrono::{DateTime, Utc, Duration};
use sb_shared_types::UserId;
use metrics::counter;
use std::env;

type SessionKey = (String, UserId, UserId);

pub struct IpCollusionTracker {
    sessions: DashMap<SessionKey, Vec<DateTime<Utc>>>,
    heads_up_limit: usize,
}

impl IpCollusionTracker {
    pub fn new() -> Self {
        let heads_up_limit = env::var("HEADS_UP_LIMIT")
            .ok()
            .and_then(|s| s.parse().ok())
            .unwrap_or(5);
        Self {
            sessions: DashMap::new(),
            heads_up_limit,
        }
    }

    pub fn record_heads_up(&self, ip: &str, user1: UserId, user2: UserId) -> bool {
        let now = Utc::now();
        let cutoff = now - Duration::hours(24);
        let (a, b) = if user1 < user2 { (user1, user2) } else { (user2, user1) };
        let key = (ip.to_string(), a, b);

        let mut timestamps = self.sessions.entry(key).or_default();
        timestamps.retain(|&ts| ts >= cutoff);
        timestamps.push(now);
        let flagged = timestamps.len() >= self.heads_up_limit;
        if flagged {
            metrics::counter!("anti_cheat_collusion_flag").increment(1);
        }
        flagged
    }

    pub fn cleanup_expired(&self) {
        let cutoff = Utc::now() - Duration::hours(24);
        self.sessions.retain(|_, timestamps| {
            timestamps.retain(|&ts| ts >= cutoff);
            !timestamps.is_empty()
        });
    }
}

impl Default for IpCollusionTracker {
    fn default() -> Self {
        Self::new()
    }
}
impl Clone for IpCollusionTracker {
    fn clone(&self) -> Self {
        Self {
            sessions: self.sessions.clone(),
            heads_up_limit: self.heads_up_limit,
        }
    }
}

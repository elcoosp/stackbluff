use dashmap::DashMap;
use chrono::{DateTime, Utc, Duration};
use sb_shared_types::UserId;

type SessionKey = (String, UserId, UserId);

pub struct IpCollusionTracker {
    sessions: DashMap<SessionKey, Vec<DateTime<Utc>>>,
}

impl IpCollusionTracker {
    pub fn new() -> Self {
        Self { sessions: DashMap::new() }
    }

    pub fn record_heads_up(&self, ip: &str, user1: UserId, user2: UserId) -> bool {
        let now = Utc::now();
        let cutoff = now - Duration::hours(24);
        let (a, b) = if user1.0 < user2.0 { (user1, user2) } else { (user2, user1) };
        let key = (ip.to_string(), a, b);

        let mut timestamps = self.sessions.entry(key).or_insert_with(Vec::new);
        timestamps.retain(|&ts| ts >= cutoff);
        timestamps.push(now);
        timestamps.len() >= 5
    }
}

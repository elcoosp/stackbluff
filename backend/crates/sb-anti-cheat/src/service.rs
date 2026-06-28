use std::sync::Arc;
use std::time::Duration;

use async_trait::async_trait;
use chrono::Utc;
use dashmap::DashMap;
use sb_db_entities::entities::{anti_cheat_events, device_fingerprints};
use sb_shared_types::{ChipAmount, RequestContext, UserId};
use sea_orm::{
    ActiveModelTrait, ColumnTrait, DatabaseConnection, EntityTrait, QueryFilter, QueryOrder, Set,
};
use tracing::{info, warn};

use crate::ip_collusion::IpCollusionTracker;
use crate::rate_limiter::RateLimiter;
use sb_contracts::service_api::{AntiCheatError, AntiCheatService};

// A key for the fingerprint tracker: (fingerprint_hash, ip)
type FingerprintKey = String;

// Store timestamps (in seconds) of each match for the pair
type FingerprintEntry = (UserId, UserId, Vec<u64>);

/// Implementation of the anti‑cheat service with fingerprint collusion detection.
pub struct AntiCheatServiceImpl {
    pub db: DatabaseConnection,
    pub ip_tracker: IpCollusionTracker,
    pub rate_limiter: Arc<RateLimiter>,
    // Map: key -> (user1, user2, list of timestamps in seconds since epoch)
    pub fingerprint_tracker: Arc<DashMap<FingerprintKey, FingerprintEntry>>,
    // Cleanup interval and max age (24h)
    max_age_secs: u64,
}

impl AntiCheatServiceImpl {
    pub fn new(db: DatabaseConnection, rate_limiter: Arc<RateLimiter>) -> Self {
        let tracker = Arc::new(DashMap::new());
        let max_age_secs = 24 * 60 * 60; // 24 hours

        // Spawn a background task to clean up old entries
        let tracker_clone = tracker.clone();
        tokio::spawn(async move {
            let mut interval = tokio::time::interval(Duration::from_secs(60 * 5));
            loop {
                interval.tick().await;
                let cutoff = Utc::now().timestamp() - (24 * 60 * 60);
                tracker_clone.retain(|_key, entry: &mut (UserId, UserId, Vec<u64>)| {
                    entry.2.retain(|&ts| ts >= cutoff as u64);
                    !entry.2.is_empty()
                });
            }
        });

        Self {
            db,
            ip_tracker: IpCollusionTracker::new(),
            rate_limiter,
            fingerprint_tracker: tracker,
            max_age_secs: max_age_secs as u64,
        }
    }

    /// Check device fingerprint collusion: if two users share the same fingerprint and IP,
    /// record the match and log an event when threshold (5 in 24h) is reached.
    #[allow(clippy::collapsible_if)]
    async fn check_fingerprint_collusion(
        &self,
        db: &DatabaseConnection,
        user1: UserId,
        user2: UserId,
        ip: &str,
    ) -> Result<(), AntiCheatError> {
        use device_fingerprints::Column as DfCol;

        let uid1 = user1.0;
        let uid2 = user2.0;

        let fp1 = device_fingerprints::Entity::find()
            .filter(DfCol::UserId.eq(uid1))
            .order_by_desc(DfCol::CreatedAt)
            .one(db)
            .await
            .map_err(|e| AntiCheatError::Database(e.to_string()))?;
        let fp2 = device_fingerprints::Entity::find()
            .filter(DfCol::UserId.eq(uid2))
            .order_by_desc(DfCol::CreatedAt)
            .one(db)
            .await
            .map_err(|e| AntiCheatError::Database(e.to_string()))?;

        if let (Some(f1), Some(f2)) = (fp1, fp2) {
            if f1.fingerprint_hash == f2.fingerprint_hash && f1.ip == f2.ip && f1.ip == ip {
                let key = format!("{}|{}", f1.fingerprint_hash, ip);
                let now = Utc::now().timestamp() as u64;
                let cutoff = now - self.max_age_secs;

                // Insert or update the entry
                let mut entry =
                    self.fingerprint_tracker
                        .entry(key.clone())
                        .or_insert((user1, user2, vec![]));
                // Clean old timestamps
                entry.2.retain(|&ts| ts >= cutoff);
                entry.2.push(now);
                let count = entry.2.len();

                info!(
                    "Fingerprint collusion count for {} and {}: {} in last 24h",
                    user1, user2, count
                );

                if count >= 5 {
                    let user_ids_str = format!("{},{}", user1, user2);
                    let event = anti_cheat_events::ActiveModel {
                        user_ids: Set(user_ids_str),
                        ip: Set(Some(ip.to_string())),
                        event_type: Set("collusion_flag".to_string()),
                        details: Set(Some(format!(
                            "Same device fingerprint and IP: {} matches in 24h with user {}; hash={}",
                            count, user2, f1.fingerprint_hash
                        ))),
                        created_at: Set(Utc::now()),
                        ..Default::default()
                    };
                    event
                        .insert(db)
                        .await
                        .map_err(|e| AntiCheatError::Database(e.to_string()))?;
                    info!("Collusion flag recorded for users {} and {}", user1, user2);
                    // Clear the timestamps to prevent repeated events
                    entry.2.clear();
                }
            }
        }
        Ok(())
    }
}

#[async_trait]
impl AntiCheatService for AntiCheatServiceImpl {
    async fn record_heads_up(
        &self,
        ip: &str,
        user1: UserId,
        user2: UserId,
        _ctx: &RequestContext,
    ) -> Result<(), AntiCheatError> {
        // IP collusion tracking
        let flagged = self.ip_tracker.record_heads_up(ip, user1, user2);
        if flagged {
            warn!("IP collusion flagged for {} and {}", user1, user2);
        }

        // Device fingerprint collusion check
        self.check_fingerprint_collusion(&self.db, user1, user2, ip)
            .await?;

        Ok(())
    }

    async fn check_transfer(
        &self,
        _from: UserId,
        _to: UserId,
        _amount: ChipAmount,
        _ctx: &RequestContext,
    ) -> Result<(), AntiCheatError> {
        // TODO: Implement transfer collusion detection
        Ok(())
    }

    fn check_game_action_rate(&self, _user_id: UserId) -> Result<(), AntiCheatError> {
        // TODO: Implement action rate limiting
        Ok(())
    }

    fn check_auth_rate(&self, _ip: &str) -> Result<(), AntiCheatError> {
        // Placeholder – rate limiter API may differ; we'll return success for now.
        // In production, call self.rate_limiter.check(ip)
        Ok(())
    }
}

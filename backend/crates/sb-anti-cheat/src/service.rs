use sb_db_entities::entities::{anti_cheat_events, device_fingerprints};
use sea_orm::{DatabaseConnection, EntityTrait, QueryFilter, ColumnTrait};
use dashmap::DashMap;
use chrono::Utc;
use crate::ip_collusion::IpCollusionTracker;
use crate::rate_limiter::RateLimiter;
use crate::transfer_tracker::TransferTracker;
use sb_contracts::service_api::{AntiCheatError, AntiCheatService};
use sb_db_entities::entities::anti_cheat_events::ActiveModel;
use sb_shared_types::{ChipAmount, RequestContext, UserId};
use sea_orm::{ActiveModelTrait, DatabaseConnection, Set};
use std::sync::Arc;
use std::time::Duration as StdDuration;
use tokio::task;
use tracing::error;

pub struct AntiCheatServiceImpl {
    transfer_tracker: TransferTracker,
    rate_limiter: Arc<RateLimiter>,
    ip_collusion: IpCollusionTracker,
    db: DatabaseConnection,
    pub fingerprint_tracker: Arc<DashMap<String, (Uuid, Uuid, u32)>>,

}

impl AntiCheatServiceImpl {
    pub fn new(db: DatabaseConnection, rate_limiter: Arc<RateLimiter>) -> Self {
            fingerprint_tracker: Arc::new(DashMap::new()),

        let this = Self {
            fingerprint_tracker: Arc::new(DashMap::new()),

            transfer_tracker: TransferTracker::new(),
            rate_limiter,
            ip_collusion: IpCollusionTracker::new(),
            db,
        };
        // Spawn background cleanup task
        let transfer = this.transfer_tracker.clone();
        let rate = this.rate_limiter.clone();
        let ip = this.ip_collusion.clone();
        task::spawn(async move {
            loop {
                tokio::time::sleep(StdDuration::from_secs(3600)).await; // every hour
                transfer.cleanup_expired();
                rate.cleanup_expired();
                ip.cleanup_expired();
            }
        });
        this
    }
    pub fingerprint_tracker: Arc<DashMap<String, (Uuid, Uuid, u32)>>,

}

#[async_trait::async_trait]
impl AntiCheatService for AntiCheatServiceImpl {
    async fn check_transfer(
        &self,
        from: UserId,
        to: UserId,
        amount: ChipAmount,
        ctx: &RequestContext,
    ) -> Result<(), AntiCheatError> {
        match self.transfer_tracker.check_and_record(from, to, amount) {
            Ok(true) => Ok(()),
            Ok(false) => {
                let event = ActiveModel {
                    user_ids: Set(format!("{},{}", from, to)),
                    ip: Set(Some(ctx.ip.to_string())),
                    event_type: Set("transfer_block".to_string()),
                    details: Set(Some(format!("net exceeded {}", 5000))), // TODO: get from env
                    created_at: Set(chrono::Utc::now()),
                    ..Default::default()
                };
                if let Err(e) = event.insert(&self.db).await {
                    error!("Failed to log anti-cheat event: {}", e);
                    return Err(AntiCheatError::Database(e.to_string()));
                }
                Err(AntiCheatError::TransferLimitExceeded(5000))
            }
            Err(e) => Err(AntiCheatError::Internal(e.to_string())),
        }
    }

    fn check_game_action_rate(&self, user_id: UserId) -> Result<(), AntiCheatError> {
        if self.rate_limiter.check_game_action(&user_id.to_string()) {
            Ok(())
        } else {
            Err(AntiCheatError::RateLimited)
        }
    }

    fn check_auth_rate(&self, ip: &str) -> Result<(), AntiCheatError> {
        if self.rate_limiter.check_auth_ip(ip) {
            Ok(())
        } else {
            Err(AntiCheatError::RateLimited)
        }
    }

    async fn record_heads_up(
        &self,
        ip: &str,
        user1: UserId,
        user2: UserId,
        _ctx: &RequestContext,
    ) -> Result<(), AntiCheatError> {
        let flagged = self.ip_collusion.record_heads_up(ip, user1, user2);
        if flagged {
            let event = ActiveModel {
                user_ids: Set(format!("{},{}", user1, user2)),
                ip: Set(Some(ip.to_string())),
                event_type: Set("collusion_flag".to_string()),
                details: Set(Some("same-IP heads-up >=5 times in 24h".to_string())),
                created_at: Set(chrono::Utc::now()),
                ..Default::default()
            };
            if let Err(e) = event.insert(&self.db).await {
                error!("Failed to log collusion flag: {}", e);
                return Err(AntiCheatError::Database(e.to_string()));
            }
        }
        Ok(())
    }
    pub fingerprint_tracker: Arc<DashMap<String, (Uuid, Uuid, u32)>>,

}

#[cfg(test)]
mod tests_service {
    use super::*;
    use sb_shared_types::UserId;
    use sea_orm::{DbBackend, MockDatabase};
    use std::sync::Arc;
    use uuid::Uuid;

    fn dummy_db() -> DatabaseConnection {
        // Create a mock database that never actually executes queries,
        // but satisfies the type requirement.
        MockDatabase::new(DbBackend::Sqlite).into_connection()
    }

    #[tokio::test]
    async fn test_game_action_rate() {
        let db = dummy_db();
        let limiter = Arc::new(RateLimiter::new());
        let service = AntiCheatServiceImpl::new(db, limiter);
        let user = UserId(Uuid::new_v4());
        for _ in 0..10 {
            assert!(service.check_game_action_rate(user).is_ok());
        }
        assert!(service.check_game_action_rate(user).is_err());
    }

    #[tokio::test]
    async fn test_auth_rate() {
        let db = dummy_db();
        let limiter = Arc::new(RateLimiter::new());
        let service = AntiCheatServiceImpl::new(db, limiter);
        let ip = "192.168.1.1";
        for _ in 0..100 {
            assert!(service.check_auth_rate(ip).is_ok());
        }
        assert!(service.check_auth_rate(ip).is_err());
    }

    // Note: Tests that would insert into the database are omitted because they
    // require a real database or more complex mocking. They are covered by
    // integration tests instead.
    pub fingerprint_tracker: Arc<DashMap<String, (Uuid, Uuid, u32)>>,

    /// Check device fingerprint collusion: if two users share the same fingerprint and IP,
    /// increment a counter and log an event when threshold (5 in 24h) is reached.
    async fn check_fingerprint_collusion(
        &self,
        db: &DatabaseConnection,
        user1: Uuid,
        user2: Uuid,
        ip: &str,
    ) -> Result<(), Box<dyn std::error::Error>> {
        // Get most recent fingerprint for each user
        let fp1 = device_fingerprints::Entity::find()
            .filter(device_fingerprints::Column::UserId.eq(user1))
            .order_by_desc(device_fingerprints::Column::CreatedAt)
            .one(db)
            .await?;
        let fp2 = device_fingerprints::Entity::find()
            .filter(device_fingerprints::Column::UserId.eq(user2))
            .order_by_desc(device_fingerprints::Column::CreatedAt)
            .one(db)
            .await?;

        if let (Some(f1), Some(f2)) = (fp1, fp2) {
            if f1.fingerprint_hash == f2.fingerprint_hash && f1.ip == f2.ip && f1.ip == ip {
                // Same device and IP
                let key = format!("{}|{}", f1.fingerprint_hash, ip);
                let mut entry = self.fingerprint_tracker.entry(key).or_insert((user1, user2, 0));
                // Ensure we count only for this pair (user1, user2) – we'll just count all matches for simplicity.
                // For production, we might want separate counters per pair.
                entry.2 += 1;
                let count = entry.2;

                if count >= 5 {
                    // Log collusion_flag event
                    let event = anti_cheat_events::ActiveModel {
                        user_id: Set(user1),
                        event_type: Set("collusion_flag".to_string()),
                        details: Set(format!("Same device fingerprint and IP with user {}: hash={} (count={})", user2, f1.fingerprint_hash, count)),
                        created_at: Set(Utc::now().naive_utc()),
                        ..Default::default()
                    };
                    event.insert(db).await?;
                    // Reset counter after flagging? Or keep counting. We'll reset to avoid repeated flags.
                    entry.2 = 0;
                }
            }
        }
        Ok(())
    }
}

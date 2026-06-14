use sb_contracts::service_api::{AntiCheatService, AntiCheatError};
use sb_shared_types::{UserId, ChipAmount, RequestContext};
use crate::transfer_tracker::TransferTracker;
use crate::rate_limiter::RateLimiter;
use crate::ip_collusion::IpCollusionTracker;
use sb_db_entities::entities::anti_cheat_events::ActiveModel;
use sea_orm::{ActiveModelTrait, DatabaseConnection, Set};
use tracing::error;
use std::sync::Arc;
use tokio::task;
use std::time::Duration as StdDuration;

pub struct AntiCheatServiceImpl {
    transfer_tracker: TransferTracker,
    rate_limiter: Arc<RateLimiter>,
    ip_collusion: IpCollusionTracker,
    db: DatabaseConnection,
}

impl AntiCheatServiceImpl {
    pub fn new(db: DatabaseConnection, rate_limiter: Arc<RateLimiter>) -> Self {
        let this = Self {
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
}

#[async_trait::async_trait]
impl AntiCheatService for AntiCheatServiceImpl {
    async fn check_transfer(&self, from: UserId, to: UserId, amount: ChipAmount, ctx: &RequestContext) -> Result<(), AntiCheatError> {
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

    async fn record_heads_up(&self, ip: &str, user1: UserId, user2: UserId, _ctx: &RequestContext) -> Result<(), AntiCheatError> {
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
}






#[cfg(test)]
mod tests_service {
    use super::*;
    use sb_shared_types::UserId;
    use sea_orm::{MockDatabase, DbBackend};
    use std::sync::Arc;
    use uuid::Uuid;

    fn dummy_db() -> DatabaseConnection {
        // Create a mock database that never actually executes queries,
        // but satisfies the type requirement.
        MockDatabase::new(DbBackend::Sqlite)
            .into_connection()
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
}

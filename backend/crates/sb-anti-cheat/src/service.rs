use sb_contracts::service_api::AntiCheatService;
use sb_shared_types::{UserId, ChipAmount, RequestContext};
use crate::transfer_tracker::TransferTracker;
use crate::rate_limiter::RateLimiter;
use crate::ip_collusion::IpCollusionTracker;
use sb_db_entities::entities::anti_cheat_events::ActiveModel;
use sea_orm::{ActiveModelTrait, DatabaseConnection, DbErr, Set};
use tracing::error;

pub struct AntiCheatServiceImpl {
    transfer_tracker: TransferTracker,
    rate_limiter: RateLimiter,
    ip_collusion: IpCollusionTracker,
    db: DatabaseConnection,
}

impl AntiCheatServiceImpl {
    pub fn new(db: DatabaseConnection) -> Self {
        Self {
            transfer_tracker: TransferTracker::new(),
            rate_limiter: RateLimiter::new(),
            ip_collusion: IpCollusionTracker::new(),
            db,
        }
    }
}

#[async_trait::async_trait]
impl AntiCheatService for AntiCheatServiceImpl {
    async fn check_transfer(&self, from: UserId, to: UserId, amount: ChipAmount) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        if self.transfer_tracker.check_and_record(from, to, amount) {
            Ok(())
        } else {
            let event = ActiveModel {
                user_ids: Set(format!("{},{}", from, to)),
                ip: Set(Some("".to_string())),
                event_type: Set("transfer_block".to_string()),
                details: Set(Some(format!("net exceeded 5000: {} -> {}", from, to))),
                created_at: Set(chrono::Utc::now()),
                ..Default::default()
            };
            if let Err(e) = event.insert(&self.db).await {
                error!("Failed to log anti-cheat event: {}", e);
            }
            Err(Box::new(crate::service::AntiCheatError::TransferLimitExceeded))
        }
    }

    fn check_game_action_rate(&self, user_id: UserId) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        if self.rate_limiter.check_game_action(&user_id.to_string()) {
            Ok(())
        } else {
            Err(Box::new(crate::service::AntiCheatError::RateLimited))
        }
    }

    fn check_auth_rate(&self, ip: &str) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        if self.rate_limiter.check_auth_ip(ip) {
            Ok(())
        } else {
            Err(Box::new(crate::service::AntiCheatError::RateLimited))
        }
    }

    async fn record_heads_up(&self, ip: &str, user1: UserId, user2: UserId, _ctx: &RequestContext) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
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
            }
        }
        Ok(())
    }
}

#[derive(Debug, thiserror::Error)]
pub enum AntiCheatError {
    #[error("net transfer limit exceeded (5000/24h)")]
    TransferLimitExceeded,
    #[error("rate limit exceeded")]
    RateLimited,
    #[error("database error: {0}")]
    Db(#[from] DbErr),
}

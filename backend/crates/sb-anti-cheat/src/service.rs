use std::sync::Arc;

use async_trait::async_trait;
use chrono::Utc;
use dashmap::DashMap;
use sea_orm::{
    ActiveModelTrait, ColumnTrait, DatabaseConnection, EntityTrait, QueryFilter, QueryOrder, Set,
};
use sb_shared_types::{ChipAmount, RequestContext, UserId};
use sb_db_entities::entities::{anti_cheat_events, device_fingerprints};

use crate::ip_collusion::IpCollusionTracker;
use crate::rate_limiter::RateLimiter;
use sb_contracts::service_api::{AntiCheatError, AntiCheatService};

/// Implementation of the anti‑cheat service.
pub struct AntiCheatServiceImpl {
    pub db: DatabaseConnection,
    pub ip_tracker: IpCollusionTracker,
    pub rate_limiter: Arc<RateLimiter>,
    pub fingerprint_tracker: Arc<DashMap<String, (UserId, UserId, u32)>>,
}

impl AntiCheatServiceImpl {
    pub fn new(db: DatabaseConnection, rate_limiter: Arc<RateLimiter>) -> Self {
        Self {
            db,
            ip_tracker: IpCollusionTracker::new(),
            rate_limiter,
            fingerprint_tracker: Arc::new(DashMap::new()),
        }
    }

    /// Check device fingerprint collusion: if two users share the same fingerprint and IP,
    /// increment a counter and log an event when threshold (5 in 24h) is reached.
    async fn check_fingerprint_collusion(
        &self,
        db: &DatabaseConnection,
        user1: UserId,
        user2: UserId,
        ip: &str,
    ) -> Result<(), AntiCheatError> {
        use device_fingerprints::Column as DfCol;

        // UserId is a newtype around Uuid, access inner via .0
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
                let mut entry = self.fingerprint_tracker.entry(key).or_insert((user1, user2, 0));
                entry.2 += 1;
                let count = entry.2;
                if count >= 5 {
                    let user_ids_str = format!("{},{}", user1, user2);
                    let event = anti_cheat_events::ActiveModel {
                        user_ids: Set(user_ids_str),
                        ip: Set(Some(ip.to_string())),
                        event_type: Set("collusion_flag".to_string()),
                        details: Set(Some(format!(
                            "Same device fingerprint and IP with user {}: hash={} (count={})",
                            user2, f1.fingerprint_hash, count
                        ))),
                        created_at: Set(Utc::now()),
                        ..Default::default()
                    };
                    event.insert(db).await
                        .map_err(|e| AntiCheatError::Database(e.to_string()))?;
                    entry.2 = 0;
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
        // IP collusion tracking (returns bool, not async)
        let _flagged = self.ip_tracker.record_heads_up(ip, user1, user2);

        // Device fingerprint collusion check
        self.check_fingerprint_collusion(&self.db, user1, user2, ip).await?;

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
        // TODO: Implement auth rate limiting via rate_limiter
        // For now, return Ok
        Ok(())
    }
}

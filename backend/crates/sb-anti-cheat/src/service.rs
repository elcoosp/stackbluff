use std::sync::Arc;
use std::time::Duration;

use async_trait::async_trait;
use chrono::Utc;
use dashmap::DashMap;
use sea_orm::{DatabaseConnection, DbErr, ActiveModelTrait, Set};
use sb_shared_types::{ChipAmount, RequestContext, UserId};
use sb_db_entities::entities::anti_cheat_events;
use tracing::{info, warn};

use crate::ip_collusion::IpCollusionTracker;
use crate::rate_limiter::RateLimiter;
use crate::repository::{FingerprintRepository, SeaFingerprintRepository};
use sb_contracts::service_api::{AntiCheatError, AntiCheatService};

type FingerprintKey = String;
type FingerprintEntry = (UserId, UserId, Vec<u64>);

/// Implementation of the anti‑cheat service with fingerprint collusion detection.
pub struct AntiCheatServiceImpl {
    pub db: DatabaseConnection,
    pub ip_tracker: IpCollusionTracker,
    pub rate_limiter: Arc<RateLimiter>,
    pub fingerprint_repo: SeaFingerprintRepository,
    pub fingerprint_tracker: Arc<DashMap<FingerprintKey, FingerprintEntry>>,
    max_age_secs: u64,
}

impl AntiCheatServiceImpl {
    pub fn new(db: DatabaseConnection, rate_limiter: Arc<RateLimiter>) -> Self {
        let tracker = Arc::new(DashMap::new());
        let max_age_secs = 24 * 60 * 60;

        // Spawn background cleanup
        let tracker_clone = tracker.clone();
        tokio::spawn(async move {
            let mut interval = tokio::time::interval(Duration::from_secs(60 * 5));
            loop {
                interval.tick().await;
                let cutoff = Utc::now().timestamp() - 24 * 60 * 60;
                tracker_clone.retain(|_key, entry: &mut (UserId, UserId, Vec<u64>)| {
                    entry.2.retain(|&ts| ts >= cutoff as u64);
                    !entry.2.is_empty()
                });
            }
        });

        Self {
            db: db.clone(),
            ip_tracker: IpCollusionTracker::new(),
            rate_limiter,
            fingerprint_repo: SeaFingerprintRepository { db },
            fingerprint_tracker: tracker,
            max_age_secs: max_age_secs as u64,
        }
    }

    /// Check device fingerprint collusion using repository.
    async fn check_fingerprint_collusion(
        &self,
        user1: UserId,
        user2: UserId,
        ip: &str,
    ) -> Result<(), AntiCheatError> {
        let (fp1, fp2): (Option<_>, Option<_>) = self.fingerprint_repo
            .get_latest_for_two_users(user1, user2)
            .await
            .map_err(|e: anyhow::Error| AntiCheatError::Database(e.to_string()))?;

        if let (Some(f1), Some(f2)) = (fp1, fp2) {
            if f1.fingerprint_hash == f2.fingerprint_hash && f1.ip == f2.ip && f1.ip == ip {
                let key = format!("{}|{}", f1.fingerprint_hash, ip);
                let now = Utc::now().timestamp() as u64;
                let cutoff = now - self.max_age_secs;

                let mut entry = self.fingerprint_tracker.entry(key.clone()).or_insert((user1, user2, vec![]));
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
                    event.insert(&self.db)
                        .await
                        .map_err(|e: DbErr| AntiCheatError::Database(e.to_string()))?;
                    info!("Collusion flag recorded for users {} and {}", user1, user2);
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
        let flagged = self.ip_tracker.record_heads_up(ip, user1, user2);
        if flagged {
            warn!("IP collusion flagged for {} and {}", user1, user2);
        }
        self.check_fingerprint_collusion(user1, user2, ip).await?;
        Ok(())
    }

    async fn check_transfer(
        &self,
        from: UserId,
        to: UserId,
        amount: ChipAmount,
        ctx: &RequestContext,
    ) -> Result<(), AntiCheatError> {
        info!("Transfer check: from={} to={} amount={:?} ctx={:?}", from, to, amount, ctx);
        Ok(())
    }

    fn check_game_action_rate(&self, user_id: UserId) -> Result<(), AntiCheatError> {
        info!("Game action rate check for user {}", user_id);
        Ok(())
    }

    fn check_auth_rate(&self, ip: &str) -> Result<(), AntiCheatError> {
        info!("Auth rate check for IP {}", ip);
        Ok(())
    }
}

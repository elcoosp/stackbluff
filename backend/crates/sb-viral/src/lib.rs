pub mod referral;
pub mod replay;
pub mod stats;

use sb_contracts::service_api::{HandResult, ReplayCard, ReferralStats, ViralService};
use sb_shared_types::{AppError, ChipAmount, UserId, TableId};
use async_trait::async_trait;
use sea_orm::DatabaseConnection;
use std::sync::Arc;
use tracing::{info, warn};

pub struct ViralServiceImpl {
    db: Arc<DatabaseConnection>,
    // Atomic counter for global user registration order (first 1000 = triple bonus)
    user_counter: Arc<tokio::sync::Mutex<u64>>,
}

impl ViralServiceImpl {
    pub fn new(db: DatabaseConnection) -> Self {
        Self {
            db: Arc::new(db),
            user_counter: Arc::new(tokio::sync::Mutex::new(0)),
        }
    }

    /// Load the global user count from DB at startup.
    pub async fn init_counter(&self) -> Result<(), AppError> {
        use sb_db_entities::prelude::SystemCounter;
        use sea_orm::{EntityTrait, ColumnTrait, QueryFilter};

        let counter = SystemCounter::find()
            .filter(sb_db_entities::system_counter::Column::Name.eq("global_user_count"))
            .one(self.db.as_ref())
            .await
            .map_err(|e| AppError::Database(e.to_string()))?;

        let mut lock = self.user_counter.lock().await;
        *lock = counter.map(|c| c.value as u64).unwrap_or(0);
        Ok(())
    }

    async fn award_bonus(&self, user_id: UserId, is_triple: bool) -> Result<(), AppError> {
        let base_amount: i64 = 100; // chip bonus for 5 hands
        let amount = if is_triple { base_amount * 3 } else { base_amount };
        // Call UserService (in real system we'd have a reference; here we assume a global service)
        // For MVP, we directly invoke a stub – will be replaced with actual UserService.
        // In a full implementation, ViralService would hold a UserService dependency.
        info!("Awarding {} chips to user {:?}", amount, user_id);
        // TODO: Call actual user_service.award_chips(user_id, amount).await
        Ok(())
    }
}

#[async_trait]
impl ViralService for ViralServiceImpl {
    async fn generate_replay_card(
        &self,
        hand_result: &HandResult,
        winner_name: &str,
        table_id: &TableId,
    ) -> Result<ReplayCard, AppError> {
        if !hand_result.is_significant() {
            return Err(AppError::InvalidInput("hand not significant".into()));
        }
        let card_id = uuid::Uuid::new_v4().to_string();
        let invite_link = format!("/?ref={}", winner_name); // placeholder: actually need winner's user id
        Ok(ReplayCard {
            card_id,
            hand_description: format!("{:?}", hand_result.hand_rank),
            winner_name: winner_name.to_string(),
            invite_link,
            timestamp: chrono::Utc::now(),
        })
    }

    async fn record_referral(
        &self,
        referrer_id: UserId,
        referred_id: UserId,
    ) -> Result<(), AppError> {
        referral::record_referral(self.db.as_ref(), referrer_id, referred_id).await
    }

    async fn on_hand_completed(&self, user_id: UserId) -> Result<(), AppError> {
        referral::increment_hand_count_and_award(self.db.as_ref(), user_id, self).await
    }

    async fn get_referral_stats(&self, user_id: UserId) -> Result<ReferralStats, AppError> {
        referral::get_stats(self.db.as_ref(), user_id).await
    }
}

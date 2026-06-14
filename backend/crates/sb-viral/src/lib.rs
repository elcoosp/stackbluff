pub mod referral;
pub mod replay;

use async_trait::async_trait;
use sb_contracts::service_api::{HandResult, ReferralStats, ReplayCard, UserService, ViralService};
use sb_shared_types::{AppError, ChipAmount, TableId, UserId};
use sea_orm::DatabaseConnection;
use std::sync::Arc;
use tracing::info;

pub struct ViralServiceImpl {
    db: Arc<DatabaseConnection>,
    user_service: Arc<dyn UserService>,
    user_counter: Arc<tokio::sync::Mutex<u64>>,
}

impl ViralServiceImpl {
    pub fn new(db: DatabaseConnection, user_service: Arc<dyn UserService>) -> Self {
        Self {
            db: Arc::new(db),
            user_service,
            user_counter: Arc::new(tokio::sync::Mutex::new(0)),
        }
    }

    pub async fn init_counter(&self) -> Result<(), AppError> {
        use sb_db_entities::prelude::SystemCounter;
        use sea_orm::{ColumnTrait, EntityTrait, QueryFilter};
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
        let base_amount: i64 = 100;
        let amount = if is_triple {
            base_amount * 3
        } else {
            base_amount
        };
        self.user_service
            .award_chips(user_id, ChipAmount::new(amount).unwrap())
            .await?;
        info!(
            "Awarded {} chips to user {:?} (triple={})",
            amount, user_id, is_triple
        );
        Ok(())
    }
}

#[async_trait]
impl ViralService for ViralServiceImpl {
    async fn generate_replay_card(
        &self,
        hand_result: &HandResult,
        winner_id: UserId,
        table_id: TableId,
    ) -> Result<ReplayCard, AppError> {
        if !hand_result.is_significant() {
            return Err(AppError::InvalidInput("hand not significant".into()));
        }
        // In real code, fetch winner name from user_service
        let winner_name = format!("user_{}", winner_id); // placeholder; ideally user_service.get_name()
        let card_id = uuid::Uuid::new_v4().to_string();
        let invite_link = format!("/?ref={}", winner_id);
        Ok(ReplayCard {
            card_id,
            hand_description: format!("{:?}", hand_result.hand_rank),
            winner_name,
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

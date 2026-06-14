use async_trait::async_trait;
use sb_contracts::repo_api::ReferralRepository;
use sb_contracts::service_api::ReferralStats;
use sb_db_entities::{prelude::*, referral, user};
use sb_shared_types::{AppError, UserId};
use sea_orm::{
    ActiveModelTrait, ColumnTrait, DatabaseConnection, EntityTrait, IntoActiveModel,
    QueryFilter, Set, TransactionTrait, UpdateMany, Expr, Condition,
};
use tracing::info;

pub struct ReferralRepositoryImpl {
    db: DatabaseConnection,
}

impl ReferralRepositoryImpl {
    pub fn new(db: DatabaseConnection) -> Self {
        Self { db }
    }
}

#[async_trait]
impl ReferralRepository for ReferralRepositoryImpl {
    async fn record_referral(&self, referrer_id: UserId, referred_id: UserId) -> Result<(), AppError> {
        let new_ref = referral::ActiveModel::builder()
            .set_referrer_id(referrer_id.to_string())
            .set_referred_id(referred_id.to_string())
            .set_hand_count(0)
            .set_bonus_awarded(false)
            .build();
        Referral::insert(new_ref)
            .exec(&self.db)
            .await
            .map_err(|e| AppError::Database(e.to_string()))?;
        Ok(())
    }

    async fn increment_hand_count_and_check_bonus(&self, referred_id: UserId) -> Result<bool, AppError> {
        use referral::COLUMN;
        // Atomic increment: UPDATE referral SET hand_count = hand_count + 1 WHERE referred_id = ? AND hand_count < 5
        let update_result = Referral::update_many()
            .col_expr(COLUMN.hand_count, Expr::col(COLUMN.hand_count).add(1))
            .filter(
                Condition::all()
                    .add(COLUMN.referred_id.eq(referred_id.to_string()))
                    .add(COLUMN.hand_count.lt(5))
            )
            .exec(&self.db)
            .await
            .map_err(|e| AppError::Database(e.to_string()))?;
        // If rows_affected > 0, we successfully incremented; check if hand_count reached exactly 5
        let referral = Referral::find()
            .filter(COLUMN.referred_id.eq(referred_id.to_string()))
            .one(&self.db)
            .await
            .map_err(|e| AppError::Database(e.to_string()))?;
        if let Some(ref_model) = referral {
            Ok(ref_model.hand_count == 5 && !ref_model.bonus_awarded)
        } else {
            Ok(false)
        }
    }

    async fn mark_bonus_awarded(&self, referred_id: UserId) -> Result<(), AppError> {
        use referral::COLUMN;
        let referral = Referral::find()
            .filter(COLUMN.referred_id.eq(referred_id.to_string()))
            .one(&self.db)
            .await
            .map_err(|e| AppError::Database(e.to_string()))?;
        if let Some(mut ref_model) = referral {
            let mut active: referral::ActiveModel = ref_model.into();
            active.bonus_awarded = Set(true);
            active.update(&self.db).await.map_err(|e| AppError::Database(e.to_string()))?;
        }
        Ok(())
    }

    async fn get_referrer_id(&self, referred_id: UserId) -> Result<Option<UserId>, AppError> {
        use referral::COLUMN;
        let referral = Referral::find()
            .filter(COLUMN.referred_id.eq(referred_id.to_string()))
            .one(&self.db)
            .await
            .map_err(|e| AppError::Database(e.to_string()))?;
        Ok(referral.map(|r| UserId::try_from(r.referrer_id).unwrap()))
    }

    async fn get_referral_stats(&self, referrer_id: UserId) -> Result<ReferralStats, AppError> {
        use referral::COLUMN;
        let referrals = Referral::find()
            .filter(COLUMN.referrer_id.eq(referrer_id.to_string()))
            .all(&self.db)
            .await
            .map_err(|e| AppError::Database(e.to_string()))?;
        let total_referred = referrals.len() as i64;
        let bonus_earned = referrals.iter().filter(|r| r.bonus_awarded).count() as i64;
        let pending_bonus = referrals.iter().filter(|r| r.hand_count >= 5 && !r.bonus_awarded).count() as i64;
        Ok(ReferralStats { total_referred, bonus_earned, pending_bonus })
    }
}

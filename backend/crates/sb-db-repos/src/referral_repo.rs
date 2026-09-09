use async_trait::async_trait;
use sb_contracts::repo_api::PersistenceError;
use sb_contracts::repo_api::ReferralRepository;
use sb_contracts::service_api::ReferralStats;
use sb_db_entities::{prelude::*, referral};
use sb_shared_types::{AppError, UserId};
use sea_orm::prelude::Expr;
use sea_orm::{
    ActiveModelTrait, Condition, DatabaseConnection, EntityTrait, ExprTrait, QueryFilter, Set,
};
use std::str::FromStr;
use uuid::Uuid;

#[derive(Clone)]
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
    async fn record_referral(
        &self,
        referrer_id: UserId,
        referred_id: UserId,
    ) -> Result<(), AppError> {
        let new_ref = referral::ActiveModel {
            referrer_id: Set(referrer_id.to_string()),
            referred_id: Set(referred_id.to_string()),
            hand_count: Set(0),
            bonus_awarded: Set(false),
            created_at: Set(chrono::Utc::now().naive_utc()),
            ..Default::default()
        };
        Referral::insert(new_ref)
            .exec(&self.db)
            .await
            .map_err(|e| AppError::Database(e.to_string()))?;
        Ok(())
    }

    async fn increment_hand_count_and_check_bonus(
        &self,
        referred_id: UserId,
    ) -> Result<bool, AppError> {
        use referral::COLUMN;
        let referred_str = referred_id.to_string();
        let update_result = Referral::update_many()
            .col_expr(COLUMN.hand_count, Expr::col(COLUMN.hand_count).add(1))
            .filter(
                Condition::all()
                    .add(COLUMN.referred_id.eq(&referred_str))
                    .add(COLUMN.hand_count.lt(5)),
            )
            .exec(&self.db)
            .await
            .map_err(|e| AppError::Database(e.to_string()))?;
        if update_result.rows_affected == 0 {
            return Ok(false);
        }
        let referral = Referral::find()
            .filter(COLUMN.referred_id.eq(&referred_str))
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
        let referred_str = referred_id.to_string();
        let referral = Referral::find()
            .filter(COLUMN.referred_id.eq(&referred_str))
            .one(&self.db)
            .await
            .map_err(|e| AppError::Database(e.to_string()))?;
        if let Some(ref_model) = referral {
            let mut active: referral::ActiveModel = ref_model.into();
            active.bonus_awarded = Set(true);
            active
                .update(&self.db)
                .await
                .map_err(|e| AppError::Database(e.to_string()))?;
        }
        Ok(())
    }

    async fn get_referrer_id(&self, referred_id: UserId) -> Result<Option<UserId>, AppError> {
        use referral::COLUMN;
        let referred_str = referred_id.to_string();
        let referral = Referral::find()
            .filter(COLUMN.referred_id.eq(&referred_str))
            .one(&self.db)
            .await
            .map_err(|e| AppError::Database(e.to_string()))?;
        if let Some(r) = referral {
            let uuid = Uuid::from_str(&r.referrer_id)
                .map_err(|_| AppError::InvalidInput("invalid referrer id".into()))?;
            Ok(Some(UserId::new(uuid)))
        } else {
            Ok(None)
        }
    }

    async fn get_referral_stats(&self, referrer_id: UserId) -> Result<ReferralStats, AppError> {
        use referral::COLUMN;
        let referrer_str = referrer_id.to_string();
        let referrals = Referral::find()
            .filter(COLUMN.referrer_id.eq(&referrer_str))
            .all(&self.db)
            .await
            .map_err(|e| AppError::Database(e.to_string()))?;
        let total_referred = referrals.len() as i64;
        let bonus_earned = referrals.iter().filter(|r| r.bonus_awarded).count() as i64;
        let pending_bonus = referrals
            .iter()
            .filter(|r| r.hand_count >= 5 && !r.bonus_awarded)
            .count() as i64;
        Ok(ReferralStats {
            total_referred,
            bonus_earned,
            pending_bonus,
        })
    }

    async fn count_completed_referrals(
        &self,
        db: &impl sea_orm::ConnectionTrait,
        referrer_id: sb_shared_types::ids::UserId,
    ) -> Result<i64, sb_contracts::persistence_error::PersistenceError> {
        use sb_db_entities::referral::{self, Entity as ReferralEntity};
        use sea_orm::{ColumnTrait, PaginatorTrait, QueryFilter};

        let count = ReferralEntity::find()
            .filter(referral::Column::ReferrerId.eq(referrer_id.0))
            .filter(referral::Column::HandCount.gte(5))
            .filter(referral::Column::BonusAwarded.eq(true))
            .count(db)
            .await
            .map_err(|e| {
                sb_contracts::persistence_error::PersistenceError::Database(e.to_string())
            })?;

        Ok(count as i64)
    }

    async fn list_referrals(
        &self,
        referrer_id: sb_shared_types::ids::UserId,
    ) -> Result<
        Vec<sb_contracts::repo_api::ReferralRecord>,
        sb_contracts::persistence_error::PersistenceError,
    > {
        use sb_db_entities::referral::{self, Entity as ReferralEntity};
        use sea_orm::{ColumnTrait, QueryFilter, QueryOrder};

        let models = ReferralEntity::find()
            .filter(referral::Column::ReferrerId.eq(referrer_id.0))
            .order_by_desc(referral::Column::CreatedAt)
            .all(&self.db)
            .await
            .map_err(|e| PersistenceError::Database(e.to_string()))?;

        let mut records = Vec::new();
        for m in models {
            // Get display name from user repo? For now, we leave it None.
            // In production, we'd join with users table.
            // But we can later enhance.
            records.push(sb_contracts::repo_api::ReferralRecord {
                referred_id: sb_shared_types::UserId::new(
                    Uuid::parse_str(&m.referred_id).map_err(|_| {
                        PersistenceError::InvalidData("invalid referred_id UUID".into())
                    })?,
                ),
                display_name: None,
                hand_count: m.hand_count,
                bonus_awarded: m.bonus_awarded,
                created_at: m.created_at.and_utc(),
            });
        }
        Ok(records)
    }
}

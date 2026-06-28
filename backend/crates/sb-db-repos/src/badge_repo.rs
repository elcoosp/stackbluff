use async_trait::async_trait;
use sea_orm::{ActiveModelTrait, 
    ColumnTrait, ConnectionTrait, DatabaseTransaction, EntityTrait, PaginatorTrait, QueryFilter,
    Set,
};
use sb_contracts::badge_repo_api::{BadgeRepo, BadgeRepoError, BadgeType};
use sb_shared_types::ids::UserId;
use std::collections::HashSet;
use tracing::{debug, error, instrument};

use sb_db_entities::user_badges::{self, Entity as UserBadgeEntity};

#[derive(Debug)]
pub struct BadgeRepoImpl;

impl BadgeRepoImpl {
    pub fn new() -> Self {
        Self
    }
}

#[async_trait]
impl BadgeRepo for BadgeRepoImpl {
    #[instrument(skip(txn), fields(user_id = %user_id.0, badge_type = %badge_type.as_str()), err)]
    async fn award_badge(
        &self,
        txn: &DatabaseTransaction,
        user_id: UserId,
        badge_type: BadgeType,
    ) -> Result<bool, BadgeRepoError> {
        let active = user_badges::ActiveModel {
            user_id: Set(user_id.0),
            badge_type: Set(badge_type.as_str().to_owned()),
            awarded_at: Set(chrono::Utc::now().into()),
        };

        match active.insert(txn).await {
            Ok(_) => {
                debug!("badge awarded");
                Ok(true)
            }
            Err(sea_orm::DbErr::RecordNotInserted) => {
                debug!("badge already existed");
                Ok(false)
            }
            Err(e) => {
                error!(error = %e, "failed to award badge");
                Err(BadgeRepoError::Database(e.to_string()))
            }
        }
    }

    #[instrument(skip(db), fields(user_id = %user_id.0), err)]
    async fn has_badge(
        &self,
        db: &impl ConnectionTrait,
        user_id: UserId,
        badge_type: &BadgeType,
    ) -> Result<bool, BadgeRepoError> {
        let count = UserBadgeEntity::find()
            .filter(user_badges::Column::UserId.eq(user_id.0))
            .filter(user_badges::Column::BadgeType.eq(badge_type.as_str()))
            .count(db)
            .await
            .map_err(|e| BadgeRepoError::Database(e.to_string()))?;

        Ok(count > 0)
    }

    #[instrument(skip(db), fields(user_id = %user_id.0), err)]
    async fn list_badges(
        &self,
        db: &impl ConnectionTrait,
        user_id: UserId,
    ) -> Result<HashSet<BadgeType>, BadgeRepoError> {
        let rows: Vec<user_badges::Model> = UserBadgeEntity::find()
            .filter(user_badges::Column::UserId.eq(user_id.0))
            .all(db)
            .await
            .map_err(|e| BadgeRepoError::Database(e.to_string()))?;

        let mut badges = HashSet::with_capacity(rows.len());
        for row in rows {
            match BadgeType::try_from(row.badge_type.as_str()) {
                Ok(badge) => {
                    badges.insert(badge);
                }
                Err(e) => {
                    error!(badge_type = %row.badge_type, error = %e, "unknown badge type in database");
                }
            }
        }
        Ok(badges)
    }
}

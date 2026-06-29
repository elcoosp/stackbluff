use async_trait::async_trait;
use sea_orm::{
    ColumnTrait, ConnectionTrait, EntityTrait, PaginatorTrait, QueryFilter,
    sea_query::OnConflict,
};
use sb_contracts::repo_api::{BadgeRecord, BadgeRepo};
use sb_contracts::persistence_error::PersistenceError;
use sb_shared_types::ids::UserId;
use sb_db_entities::user_badges::{self, Entity as UserBadgeEntity};

pub struct BadgeRepoImpl<DB: ConnectionTrait + Send + Sync> {
    db: DB,
}

impl<DB: ConnectionTrait + Send + Sync> BadgeRepoImpl<DB> {
    pub fn new(db: DB) -> Self {
        Self { db }
    }
}

#[async_trait]
impl<DB: ConnectionTrait + Send + Sync> BadgeRepo for BadgeRepoImpl<DB> {
    async fn award_badge(
        &self,
        user_id: UserId,
        badge_type: &str,
    ) -> Result<bool, PersistenceError> {
        // Use ON CONFLICT DO NOTHING to handle race conditions atomically
        let active = user_badges::ActiveModel {
            user_id: sea_orm::ActiveValue::Set(user_id.as_uuid()),
            badge_type: sea_orm::ActiveValue::Set(badge_type.to_string()),
            awarded_at: sea_orm::ActiveValue::Set(chrono::Utc::now()),
        };

        let result = UserBadgeEntity::insert(active)
            .on_conflict(
                OnConflict::columns([user_badges::Column::UserId, user_badges::Column::BadgeType])
                    .do_nothing()
                    .to_owned(),
            )
            .exec(&self.db)
            .await;

        match result {
            Ok(_) => Ok(true),
            Err(sea_orm::DbErr::RecordNotInserted) => Ok(false),
            Err(e) => Err(PersistenceError::Database(e.to_string())),
        }
    }

    async fn has_badge(
        &self,
        user_id: UserId,
        badge_type: &str,
    ) -> Result<bool, PersistenceError> {
        let count: u64 = UserBadgeEntity::find()
            .filter(user_badges::Column::UserId.eq(user_id.as_uuid()))
            .filter(user_badges::Column::BadgeType.eq(badge_type))
            .count(&self.db)
            .await
            .map_err(|e| PersistenceError::Database(e.to_string()))?;
        Ok(count > 0u64)
    }

    async fn list_badges(
        &self,
        user_id: UserId,
    ) -> Result<Vec<BadgeRecord>, PersistenceError> {
        let models = UserBadgeEntity::find()
            .filter(user_badges::Column::UserId.eq(user_id.as_uuid()))
            .all(&self.db)
            .await
            .map_err(|e| PersistenceError::Database(e.to_string()))?;

        Ok(models
            .into_iter()
            .map(|m| BadgeRecord {
                user_id: UserId::new(m.user_id),
                badge_type: m.badge_type,
                awarded_at: m.awarded_at,
            })
            .collect())
    }
}

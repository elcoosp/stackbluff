use async_trait::async_trait;
use sea_orm::{ActiveModelTrait, ColumnTrait, ConnectionTrait, EntityTrait, PaginatorTrait, QueryFilter, Set};
use sb_contracts::badge_repo_api::{BadgeRepo, BadgeType};
use sb_shared_types::ids::UserId;
use std::collections::HashSet;

use sb_db_entities::user_badges::{self, Entity as UserBadgeEntity};

pub struct BadgeRepoImpl<C> {
    db: C,
}

impl<C> BadgeRepoImpl<C> {
    pub fn new(db: C) -> Self {
        Self { db }
    }
}

#[async_trait]
impl<C> BadgeRepo for BadgeRepoImpl<C>
where
    C: ConnectionTrait + Send + Sync,
{
    async fn award_badge(
        &self,
        user_id: UserId,
        badge_type: BadgeType,
    ) -> Result<bool, sb_contracts::persistence_error::PersistenceError> {
        let existing = UserBadgeEntity::find()
            .filter(user_badges::Column::UserId.eq(user_id.0))
            .filter(user_badges::Column::BadgeType.eq(badge_type.as_str()))
            .one(&self.db)
            .await
            .map_err(|e| sb_contracts::persistence_error::PersistenceError::Database(e.to_string()))?;

        if existing.is_some() {
            return Ok(false);
        }

        let active = user_badges::ActiveModel {
            user_id: Set(user_id.0),
            badge_type: Set(badge_type.as_str().to_owned()),
            awarded_at: Set(chrono::Utc::now()),
        };

        active
            .insert(&self.db)
            .await
            .map_err(|e| sb_contracts::persistence_error::PersistenceError::Database(e.to_string()))?;

        Ok(true)
    }

    async fn has_badge(
        &self,
        user_id: UserId,
        badge_type: &BadgeType,
    ) -> Result<bool, sb_contracts::persistence_error::PersistenceError> {
        let count = UserBadgeEntity::find()
            .filter(user_badges::Column::UserId.eq(user_id.0))
            .filter(user_badges::Column::BadgeType.eq(badge_type.as_str()))
            .count(&self.db)
            .await
            .map_err(|e| sb_contracts::persistence_error::PersistenceError::Database(e.to_string()))?;

        Ok(count > 0)
    }

    async fn list_badges(
        &self,
        user_id: UserId,
    ) -> Result<HashSet<BadgeType>, sb_contracts::persistence_error::PersistenceError> {
        let rows: Vec<user_badges::Model> = UserBadgeEntity::find()
            .filter(user_badges::Column::UserId.eq(user_id.0))
            .all(&self.db)
            .await
            .map_err(|e| sb_contracts::persistence_error::PersistenceError::Database(e.to_string()))?;

        let mut badges = HashSet::new();
        for row in rows {
            if let Ok(badge) = BadgeType::try_from(row.badge_type.as_str()) {
                badges.insert(badge);
            }
        }

        Ok(badges)
    }
}

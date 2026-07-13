use async_trait::async_trait;
use sea_orm::{DatabaseConnection, EntityTrait, Set, QueryFilter, ColumnTrait};
use uuid::Uuid;
use chrono::Utc;
use anyhow::Result;
use sb_db_entities::push_subscription::{Entity, ActiveModel, Model, Column};

#[async_trait]
pub trait PushSubscriptionRepo: Send + Sync {
    async fn insert(&self, user_id: Uuid, endpoint: String, p256dh: String, auth: String, expiration_time: Option<i64>) -> Result<()>;
    async fn list_for_user(&self, user_id: Uuid) -> Result<Vec<Model>>;
    async fn delete_by_endpoint(&self, endpoint: String) -> Result<()>;
    async fn delete_expired(&self) -> Result<()>;
}

pub struct PushSubscriptionRepoImpl {
    pub db: DatabaseConnection,
}

#[async_trait]
impl PushSubscriptionRepo for PushSubscriptionRepoImpl {
    async fn insert(&self, user_id: Uuid, endpoint: String, p256dh: String, auth: String, expiration_time: Option<i64>) -> Result<()> {
        let model = ActiveModel {
            id: Set(Uuid::new_v4()),
            user_id: Set(user_id),
            endpoint: Set(endpoint),
            p256dh: Set(p256dh),
            auth: Set(auth),
            expiration_time: Set(expiration_time),
            created_at: Set(Utc::now()),
        };
        Entity::insert(model).exec(&self.db).await?;
        Ok(())
    }

    async fn list_for_user(&self, user_id: Uuid) -> Result<Vec<Model>> {
        Ok(Entity::find().filter(Column::UserId.eq(user_id)).all(&self.db).await?)
    }

    async fn delete_by_endpoint(&self, endpoint: String) -> Result<()> {
        Entity::delete_many().filter(Column::Endpoint.eq(endpoint)).exec(&self.db).await?;
        Ok(())
    }

    async fn delete_expired(&self) -> Result<()> {
        let now = Utc::now().timestamp();
        Entity::delete_many().filter(Column::ExpirationTime.lt(Some(now))).exec(&self.db).await?;
        Ok(())
    }
}

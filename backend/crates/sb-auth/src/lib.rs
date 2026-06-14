use async_trait::async_trait;
use sb_shared_types::UserId;

#[async_trait]
pub trait Authenticator: Send + Sync {
    async fn validate_token(&self, token: &str) -> Result<UserId, &'static str>;
}

pub struct NoopAuthenticator;

#[async_trait]
impl Authenticator for NoopAuthenticator {
    async fn validate_token(&self, _token: &str) -> Result<UserId, &'static str> {
        tracing::warn!("Using NoopAuthenticator – insecure stub");
        Ok(UserId(uuid::Uuid::new_v4()))
    }
}
pub mod middleware;
pub use middleware::{AuthUser, auth_middleware};

use sb_db_entities::system_counter;
use sea_orm::{ActiveModelTrait, ColumnTrait, EntityTrait, QueryFilter, Set};

pub async fn increment_global_user_counter(db: &DatabaseConnection) -> Result<u64, DbErr> {
    let counter = system_counter::Entity::find()
        .filter(system_counter::Column::Name.eq("global_user_count"))
        .one(db)
        .await?;
    if let Some(c) = counter {
        let mut active: system_counter::ActiveModel = c.into();
        let new_val = active.value.as_ref() + 1;
        active.value = Set(new_val);
        active.update(db).await?;
        Ok(new_val as u64)
    } else {
        Ok(0)
    }
}

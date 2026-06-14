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

use sea_orm::{EntityTrait, QueryFilter, ColumnTrait, ActiveValue, IntoSimpleExpr, Expr};
use sb_db_entities::system_counter;

pub async fn increment_global_user_counter(db: &DatabaseConnection) -> Result<u64, DbErr> {
    use system_counter::COLUMN;
    // Atomic increment using SQL update
    let update_result = system_counter::Entity::update_many()
        .col_expr(COLUMN.value, Expr::col(COLUMN.value).add(1))
        .filter(COLUMN.name.eq("global_user_count"))
        .exec(db)
        .await?;
    if update_result.rows_affected == 0 {
        return Ok(0);
    }
    // Read the new value
    let counter = system_counter::Entity::find()
        .filter(COLUMN.name.eq("global_user_count"))
        .one(db)
        .await?;
    Ok(counter.map(|c| c.value as u64).unwrap_or(0))
}

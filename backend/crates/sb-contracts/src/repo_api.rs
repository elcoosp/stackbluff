use async_trait::async_trait;
use sb_shared_types::{RequestContext, UserId};

#[derive(Debug, thiserror::Error)]
pub enum PersistenceError {
    #[error("Constraint violation (UNIQUE/CHECK): {0}")]
    ConstraintViolation(String),
    #[error("Data integrity error: {0}")]
    DataIntegrity(String),
    #[error("Transient database error (retryable): {0}")]
    Transient(String),
    #[error("Record not found")]
    NotFound,
}

pub type PersistenceResult<T> = Result<T, PersistenceError>;

pub struct UserCreate {
    pub telegram_id: i64,
    pub email: String,
    pub display_name: String,
    pub platform: String,
}

#[async_trait]
pub trait UserRepository: Send + Sync {
    async fn create_user(
        &self,
        ctx: RequestContext,
        create: UserCreate,
    ) -> PersistenceResult<UserId>;
    async fn get_user(&self, ctx: RequestContext, id: UserId) -> PersistenceResult<String>;
    async fn update_chip_balance(
        &self,
        ctx: RequestContext,
        user_id: UserId,
        delta: i64,
    ) -> PersistenceResult<()>;
}

#[async_trait]
pub trait HandHistoryRepository: Send + Sync {
    async fn store_hand(
        &self,
        ctx: RequestContext,
        hand_data: serde_json::Value,
    ) -> PersistenceResult<()>;
}

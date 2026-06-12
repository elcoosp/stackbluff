//! Data access traits (repository layer)
use async_trait::async_trait;
use sb_shared_types::{RequestContext, UserId};
use serde_json;

#[derive(Debug, thiserror::Error)]
pub enum PersistenceError {
    #[error("Constraint violation: {0}")]
    ConstraintViolation(String),
    #[error("Transient database error: {0}")]
    Transient(String),
    #[error("Not found")]
    NotFound,
}

pub type PersistenceResult<T> = Result<T, PersistenceError>;

pub struct UserCreate {
    pub name: String,
    pub initial_chips: i64,
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

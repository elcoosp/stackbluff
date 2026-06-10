use chrono::{DateTime, Utc};
use async_trait::async_trait;
use sb_shared_types::UserId;

#[derive(Debug, thiserror::Error)]
pub enum PersistenceError {
    #[error("Database error: {0}")]
    Database(String),
    #[error("Not found")]
    NotFound,
    #[error("Invalid state transition")]
    InvalidState,
    #[error("Write conflict")]
    WriteConflict,
}

pub type PersistenceResult<T> = Result<T, PersistenceError>;

#[derive(Debug, Clone)]
pub struct User {
    pub id: UserId,
    pub telegram_id: Option<i64>,
    pub email: Option<String>,
    pub display_name: String,
    pub chip_balance: i64,
    pub streak_count: i32,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub platform: String,
    pub email_verified_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Clone)]
pub struct UserCreate {
    pub telegram_id: Option<i64>,
    pub email: Option<String>,
    pub display_name: String,
    pub platform: String,
}

#[async_trait]
pub trait UserRepository: Send + Sync {
    async fn create_user(&self, user: UserCreate) -> PersistenceResult<UserId>;
    async fn get_user(&self, id: UserId) -> PersistenceResult<User>;
    async fn update_chip_balance(&self, id: UserId, delta: i64) -> PersistenceResult<()>;
}

#[async_trait]
pub trait MissionRepository: Send + Sync {
    async fn complete_mission(&self, user_id: UserId, mission_type: String) -> PersistenceResult<()>;
}
pub mod service_api;
pub mod repo_api;
// Auto-generated stub for #005 - TableCommand
#[derive(Debug)] pub enum TableCommand { Join { player_id: sb_shared_types::PlayerId, table_id: sb_shared_types::TableId } }

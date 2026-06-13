//! Contract types for StackBluff

use async_trait::async_trait;
use chrono::{DateTime, Utc};
use sb_shared_types::{ClubId, PlayerId, TableId, UserId};
use thiserror::Error;

/// Unified persistence error type.
/// Merges root, repo_api, and persistence_error variants into one enum.
#[derive(Debug, Error)]
pub enum PersistenceError {
    // Root variants
    #[error("Database error: {0}")]
    Database(String),
    #[error("Not found")]
    NotFound,
    #[error("Invalid state transition")]
    InvalidState,
    #[error("Write conflict")]
    WriteConflict,
    // repo_api variants
    #[error("Constraint violation (UNIQUE/CHECK): {0}")]
    ConstraintViolation(String),
    #[error("Data integrity error: {0}")]
    DataIntegrity(String),
    #[error("Transient database error (retryable): {0}")]
    Transient(String),
    // persistence_error variants
    #[error("Fatal error: {0}")]
    Fatal(String),
    // Club variants
    #[error("Club not found")]
    ClubNotFound,
    #[error("Already a member of this club")]
    AlreadyMember,
    #[error("Not a member of this club")]
    NotAMember,
    #[error("Validation error: {0}")]
    ValidationError(String),
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
    async fn complete_mission(
        &self,
        user_id: UserId,
        mission_type: String,
    ) -> PersistenceResult<()>;
}

pub mod repo_api;
pub mod service_api;
pub mod lobby_api;
pub mod persistence_error;
pub mod async_hooks;

pub use lobby_api::{TableInfo, TableRepo, TableService};
pub use repo_api::{Club, ClubMembership, ClubRepo, DIVISION_SIZE, LeaderboardEntry, LeaderboardPage};
pub use service_api::ClubService;

#[derive(Debug, Error)]
pub enum TableError {
    #[error("Table {0} not found")]
    NotFound(TableId),
    #[error("Table {0} is full")]
    TableFull(TableId),
    #[error("Internal actor error: {0}")]
    ActorError(String),
}

#[derive(Debug)]
pub enum TableCommand {
    Join {
        player_id: PlayerId,
        table_id: TableId,
        response_tx: tokio::sync::oneshot::Sender<Result<(), TableError>>,
    },
    Heartbeat {
        table_id: TableId,
    },
}

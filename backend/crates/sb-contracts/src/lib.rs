//! Contract types for StackBluff

use async_trait::async_trait;
use chrono::{DateTime, Utc};
use sb_shared_types::{ClubId, PlayerId, TableId, UserId};

// ── Base infrastructure error ──────────────────────────────────

/// Low-level database/infrastructure error with preserved source chain.
#[derive(Debug, thiserror::Error)]
pub enum PersistenceError {
    #[error("database error: {message}")]
    Database {
        message: String,
        #[source]
        source: Option<Box<dyn std::error::Error + Send + Sync>>,
    },
    #[error("not found")]
    NotFound,
    #[error("write conflict")]
    WriteConflict,
}

impl PersistenceError {
    pub fn database(msg: impl Into<String>) -> Self {
        Self::Database { message: msg.into(), source: None }
    }

    pub fn database_with_source(
        msg: impl Into<String>,
        err: impl std::error::Error + Send + Sync + 'static,
    ) -> Self {
        Self::Database {
            message: msg.into(),
            source: Some(Box::new(err)),
        }
    }
}

pub type PersistenceResult<T> = Result<T, PersistenceError>;

// ── Domain models ──────────────────────────────────────────────

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

// ── Modules ────────────────────────────────────────────────────

pub mod repo_api;
pub mod service_api;
pub mod lobby_api;
pub mod persistence_error;
pub mod club_error;
pub mod async_hooks;
pub mod notification_api;
pub mod user_resolution;

pub use lobby_api::{TableInfo, TableRepo, TableService};
pub use club_error::ClubError;
pub use repo_api::ClubRepo;

#[derive(Debug, thiserror::Error)]
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

//! Contract types for StackBluff

use async_trait::async_trait;
use chrono::{DateTime, Utc};
use sb_shared_types::{PlayerId, TableId, UserId};

// ── Base infrastructure error ──────────────────────────────────

/// Database/infrastructure error with preserved source chain.
///
/// Variant semantics:
/// - `Database`: Unexpected infrastructure failure (connection lost, query syntax error).
///   Caller should log and return 500. Not safe to retry without investigation.
/// - `Transient`: Retryable infrastructure error (deadlock, timeout, connection pool exhaustion).
///   Safe to retry with backoff.
/// - `ConstraintViolation`: Client sent data that violates a database constraint
///   (UNIQUE, CHECK). Should map to 400/409. Never retry with the same data.
/// - `DataIntegrity`: Schema-level violation (NOT NULL, FOREIGN KEY).
///   Indicates a bug in application logic. Should map to 422/500.
/// - `NotFound`: Requested entity does not exist. Maps to 404.
/// - `WriteConflict`: Optimistic concurrency conflict. Maps to 409.
#[derive(Debug, thiserror::Error)]
pub enum PersistenceError {
    #[error("database error: {message}")]
    Database {
        message: String,
        #[source]
        source: Option<Box<dyn std::error::Error + Send + Sync>>,
    },

    #[error("transient error: {message}")]
    Transient {
        message: String,
        #[source]
        source: Option<Box<dyn std::error::Error + Send + Sync>>,
    },

    #[error("constraint violation: {message}")]
    ConstraintViolation { message: String },

    #[error("data integrity error: {message}")]
    DataIntegrity { message: String },

    #[error("not found")]
    NotFound,

    #[error("write conflict")]
    WriteConflict,
}

impl PersistenceError {
    // ── Database (non-retryable infrastructure error) ──────

    pub fn database(msg: impl Into<String>) -> Self {
        Self::Database {
            message: msg.into(),
            source: None,
        }
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

    // ── Transient (retryable infrastructure error) ─────────

    pub fn transient(msg: impl Into<String>) -> Self {
        Self::Transient {
            message: msg.into(),
            source: None,
        }
    }

    pub fn transient_with_source(
        msg: impl Into<String>,
        err: impl std::error::Error + Send + Sync + 'static,
    ) -> Self {
        Self::Transient {
            message: msg.into(),
            source: Some(Box::new(err)),
        }
    }

    // ── ConstraintViolation (client data error) ────────────

    pub fn constraint_violation(msg: impl Into<String>) -> Self {
        Self::ConstraintViolation {
            message: msg.into(),
        }
    }

    // ── DataIntegrity (schema/logic violation) ─────────────

    pub fn data_integrity(msg: impl Into<String>) -> Self {
        Self::DataIntegrity {
            message: msg.into(),
        }
    }

    /// Returns `true` if this error is safe to retry (Transient or WriteConflict).
    pub fn is_retryable(&self) -> bool {
        matches!(self, Self::Transient { .. } | Self::WriteConflict)
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

pub mod async_hooks;
pub mod club_error;
pub mod lobby_api;
pub mod notification_api;
pub mod persistence_error;
pub mod repo_api;
pub mod service_api;
pub mod user_resolution;

pub use club_error::ClubError;
pub use lobby_api::{TableInfo, TableRepo, TableService};
pub use repo_api::{
    Club, ClubMembership, ClubRepo, DIVISION_SIZE, LeaderboardEntry, LeaderboardPage,
};
pub use service_api::ClubService;

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

pub mod async_hooks;
pub mod badge_repo_api;
pub mod club_error;
pub mod leaderboard;
pub mod lobby_api;
pub mod notification;
pub mod notification_api;
pub mod persistence_error;
pub mod puzzle_repo;
pub mod repo_api;
pub mod service_api;
pub mod stats_api;
pub mod tournament_api;
pub mod user_resolution;
pub mod product_api;

pub use lobby_api::{CreateTableInput, TableService};
pub use service_api::{ClubService, ReferralStats, ReplayCard, UserService, ViralService};

pub use async_hooks::{HandCountObserver, ReplayCardObserver};
pub use badge_repo_api::{BadgeRepo, BadgeType};
pub use club_error::ClubError;
pub use lobby_api::TableInfo;
pub use repo_api::BadgeRepo as RepoBadgeRepo;
pub use repo_api::{
    BadgeRecord, ClubRepo, DIVISION_SIZE, HandHistoryRepository, HandSummary, HandSummaryPage,
    LeaderboardPage, NoopBadgeRepo, WinnerSummary,
};

// ── Table Registry contracts ──────────────────────────────────────────────
use sb_shared_types::TableId;

#[derive(Debug, Clone, thiserror::Error)]
pub enum TableError {
    #[error("Table not found: {0}")]
    NotFound(sb_shared_types::TableId),
    #[error("Table already exists")]
    AlreadyExists,
    #[error("Permission denied")]
    PermissionDenied,
    #[error("Internal error: {0}")]
    Internal(String),
    #[error("Actor error: {0}")]
    ActorError(String),
}

#[derive(Debug)]
pub enum TableCommand {
    CreateTable {
        table_id: TableId,
        stake_level: sb_shared_types::StakeLevel,
        max_players: u32,
        reply_to: tokio::sync::oneshot::Sender<Result<(), TableError>>,
    },
    RemoveTable {
        table_id: TableId,
        reply_to: tokio::sync::oneshot::Sender<Result<(), TableError>>,
    },
    GetTableInfo {
        table_id: TableId,
        reply_to: tokio::sync::oneshot::Sender<Result<TableInfo, TableError>>,
    },
    ListTables {
        reply_to: tokio::sync::oneshot::Sender<Result<Vec<TableInfo>, TableError>>,
    },
    Join {
        table_id: sb_shared_types::TableId,
        user_id: sb_shared_types::UserId,
        reply_to: tokio::sync::oneshot::Sender<Result<(), TableError>>,
    },
    Heartbeat {
        table_id: sb_shared_types::TableId,
    },
}
pub mod r2_storage;

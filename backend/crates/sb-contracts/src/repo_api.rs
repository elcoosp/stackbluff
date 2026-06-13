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


// ── Club domain types ────────────────────────────────────────

/// Club DTO returned from the repository layer.
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct Club {
    pub id: sb_shared_types::ClubId,
    pub name: String,
    pub logo_url: Option<String>,
    pub created_by: sb_shared_types::UserId,
}

/// A single member's data inside a club.
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct ClubMembership {
    pub club_id: sb_shared_types::ClubId,
    pub user_id: sb_shared_types::UserId,
    pub weekly_xp: i64,
}

/// One row in the leaderboard.
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct LeaderboardEntry {
    pub rank: u32,
    pub user_id: sb_shared_types::UserId,
    pub weekly_xp: i64,
}

/// A page of leaderboard results for a single division.
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct LeaderboardPage {
    pub club_id: sb_shared_types::ClubId,
    pub division: u32,
    pub total_divisions: u32,
    pub total_members: u64,
    pub entries: Vec<LeaderboardEntry>,
}

/// Division size constant: 500 members per division.
pub const DIVISION_SIZE: u32 = 500;

/// Repository interface for club persistence.
#[async_trait::async_trait]
pub trait ClubRepo: Send + Sync {
    async fn create_club(
        &self,
        name: &str,
        logo_url: Option<&str>,
        created_by: sb_shared_types::UserId,
    ) -> Result<sb_shared_types::ClubId, crate::PersistenceError>;

    async fn find_club_by_id(
        &self,
        club_id: sb_shared_types::ClubId,
    ) -> Result<Option<Club>, crate::PersistenceError>;

    async fn join_club(
        &self,
        club_id: sb_shared_types::ClubId,
        user_id: sb_shared_types::UserId,
    ) -> Result<(), crate::PersistenceError>;

    async fn is_member(
        &self,
        club_id: sb_shared_types::ClubId,
        user_id: sb_shared_types::UserId,
    ) -> Result<bool, crate::PersistenceError>;

    async fn get_member_count(
        &self,
        club_id: sb_shared_types::ClubId,
    ) -> Result<u64, crate::PersistenceError>;

    async fn get_leaderboard_page(
        &self,
        club_id: sb_shared_types::ClubId,
        division: u32,
    ) -> Result<LeaderboardPage, crate::PersistenceError>;

    async fn increment_weekly_xp(
        &self,
        club_id: sb_shared_types::ClubId,
        user_id: sb_shared_types::UserId,
        xp: i64,
    ) -> Result<(), crate::PersistenceError>;

    async fn refresh_leaderboard(
        &self,
        club_id: sb_shared_types::ClubId,
    ) -> Result<(), crate::PersistenceError>;

    async fn get_all_club_ids(&self) -> Result<Vec<sb_shared_types::ClubId>, crate::PersistenceError>;
}

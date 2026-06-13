use async_trait::async_trait;
use sb_shared_types::{ClubId, RequestContext, UserId};

// Re-export PersistenceError and PersistenceResult from crate root
// so that `sb_contracts::repo_api::PersistenceError` still works for downstream crates.
pub use crate::{PersistenceError, PersistenceResult};

// ── Existing repository types ──────────────────────────────────

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
    pub id: ClubId,
    pub name: String,
    pub logo_url: Option<String>,
    pub created_by: UserId,
}

/// A single member's data inside a club.
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct ClubMembership {
    pub club_id: ClubId,
    pub user_id: UserId,
    pub weekly_xp: i64,
}

/// One row in the leaderboard.
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct LeaderboardEntry {
    pub rank: u32,
    pub user_id: UserId,
    pub weekly_xp: i64,
}

/// A page of leaderboard results for a single division.
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct LeaderboardPage {
    pub club_id: ClubId,
    pub division: u32,
    pub total_divisions: u32,
    pub total_members: u64,
    pub entries: Vec<LeaderboardEntry>,
}

/// Division size constant: 500 members per division.
pub const DIVISION_SIZE: u32 = 500;

/// Repository interface for club persistence.
#[async_trait]
pub trait ClubRepo: Send + Sync {
    async fn create_club(
        &self,
        name: &str,
        logo_url: Option<&str>,
        created_by: UserId,
    ) -> Result<ClubId, PersistenceError>;

    async fn find_club_by_id(
        &self,
        club_id: ClubId,
    ) -> Result<Option<Club>, PersistenceError>;

    async fn join_club(
        &self,
        club_id: ClubId,
        user_id: UserId,
    ) -> Result<(), PersistenceError>;

    async fn is_member(
        &self,
        club_id: ClubId,
        user_id: UserId,
    ) -> Result<bool, PersistenceError>;

    async fn get_member_count(
        &self,
        club_id: ClubId,
    ) -> Result<u64, PersistenceError>;

    async fn get_leaderboard_page(
        &self,
        club_id: ClubId,
        division: u32,
    ) -> Result<LeaderboardPage, PersistenceError>;

    async fn increment_weekly_xp(
        &self,
        club_id: ClubId,
        user_id: UserId,
        xp: i64,
    ) -> Result<(), PersistenceError>;

    async fn refresh_leaderboard(
        &self,
        club_id: ClubId,
    ) -> Result<(), PersistenceError>;

    async fn get_all_club_ids(&self) -> Result<Vec<ClubId>, PersistenceError>;
}

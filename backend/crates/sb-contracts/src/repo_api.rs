use async_trait::async_trait;
use sb_shared_types::{ClubId, RequestContext, UserId};

pub use crate::club_error::ClubError;
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

/// Result type for club operations.
pub type ClubResult<T> = Result<T, ClubError>;

/// Repository interface for club persistence.
///
/// ## Contracts
/// - `join_club`: If the user is already a member (UNIQUE constraint),
///   returns `ClubError::AlreadyMember`. Callers need NOT check `is_member` first.
/// - `increment_weekly_xp`: Must be atomic (single SQL statement).
/// - `refresh_leaderboard`: Must run inside a transaction for atomicity.
#[async_trait]
pub trait ClubRepo: Send + Sync {
    async fn create_club(
        &self,
        name: &str,
        logo_url: Option<&str>,
        created_by: UserId,
    ) -> ClubResult<ClubId>;

    async fn find_club_by_id(&self, club_id: ClubId) -> ClubResult<Option<Club>>;

    /// Join a club. Returns `ClubError::AlreadyMember` on duplicate.
    /// Does NOT require a prior `is_member` check — the UNIQUE constraint
    /// is the authoritative guard.
    async fn join_club(&self, club_id: ClubId, user_id: UserId) -> ClubResult<()>;

    async fn is_member(&self, club_id: ClubId, user_id: UserId) -> ClubResult<bool>;

    async fn get_member_count(&self, club_id: ClubId) -> ClubResult<u64>;

    async fn get_leaderboard_page(
        &self,
        club_id: ClubId,
        division: u32,
    ) -> ClubResult<LeaderboardPage>;

    /// Atomically add XP. Must use a single SQL UPDATE statement.
    async fn increment_weekly_xp(
        &self,
        club_id: ClubId,
        user_id: UserId,
        xp: i64,
    ) -> ClubResult<()>;

    /// Materialise the leaderboard snapshot. Must run in a transaction.
    async fn refresh_leaderboard(&self, club_id: ClubId) -> ClubResult<()>;

    /// Return all club ids for the scheduled refresh job.
    async fn get_all_club_ids(&self) -> ClubResult<Vec<ClubId>>;
}

#[async_trait::async_trait]
pub trait ReferralRepository: Send + Sync {
    async fn record_referral(&self, referrer_id: UserId, referred_id: UserId) -> Result<(), AppError>;
    async fn increment_hand_count_and_check_bonus(&self, referred_id: UserId) -> Result<bool, AppError>;
    async fn mark_bonus_awarded(&self, referred_id: UserId) -> Result<(), AppError>;
    async fn get_referrer_id(&self, referred_id: UserId) -> Result<Option<UserId>, AppError>;
    async fn get_referral_stats(&self, referrer_id: UserId) -> Result<ReferralStats, AppError>;
}

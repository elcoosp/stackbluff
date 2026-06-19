use crate::service_api::ReferralStats;
use sb_shared_types::{AppError, UserId};

use async_trait::async_trait;
use sb_shared_types::{ClubId, RequestContext};

pub use crate::club_error::ClubError;
pub use crate::persistence_error::{PersistenceError, PersistenceResult};

// ── Existing repository types ──────────────────────────────────

pub struct UserCreate {
    pub telegram_id: i64,
    pub email: String,
    pub display_name: String,
    pub platform: String,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct UserProfile {
    pub id: UserId,
    pub display_name: String,
    pub email: Option<String>,
    pub chip_balance: i64,
}

#[async_trait]
pub trait UserRepository: Send + Sync {
    async fn create_user(
        &self,
        ctx: RequestContext,
        create: UserCreate,
    ) -> PersistenceResult<UserId>;
    async fn get_user(&self, ctx: RequestContext, id: UserId) -> PersistenceResult<String>;
    async fn get_user_profile(
        &self,
        ctx: RequestContext,
        id: UserId,
    ) -> PersistenceResult<UserProfile>;

    /// Updates the user's chip balance by `delta`. Returns the new balance.
    async fn update_chip_balance(
        &self,
        ctx: RequestContext,
        user_id: UserId,
        delta: i64,
    ) -> PersistenceResult<i64>;

    async fn find_or_create_by_telegram(
        &self,
        ctx: RequestContext,
        tg_id: i64,
    ) -> PersistenceResult<UserId>;

    async fn create_email_user(
        &self,
        ctx: RequestContext,
        username: &str,
        email: &str,
        password_hash: &str,
    ) -> PersistenceResult<UserId>;

    async fn find_by_email(
        &self,
        ctx: RequestContext,
        email: &str,
    ) -> PersistenceResult<Option<UserId>>;
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

#[async_trait]
pub trait ClubRepo: Send + Sync {
    async fn create_club(
        &self,
        name: &str,
        logo_url: Option<&str>,
        created_by: UserId,
    ) -> ClubResult<ClubId>;

    async fn find_club_by_id(&self, club_id: ClubId) -> ClubResult<Option<Club>>;

    async fn join_club(&self, club_id: ClubId, user_id: UserId) -> ClubResult<()>;

    async fn is_member(&self, club_id: ClubId, user_id: UserId) -> ClubResult<bool>;

    async fn get_member_count(&self, club_id: ClubId) -> ClubResult<u64>;

    async fn get_leaderboard_page(
        &self,
        club_id: ClubId,
        division: u32,
    ) -> ClubResult<LeaderboardPage>;

    async fn increment_weekly_xp(
        &self,
        club_id: ClubId,
        user_id: UserId,
        xp: i64,
    ) -> ClubResult<()>;

    async fn refresh_leaderboard(&self, club_id: ClubId) -> ClubResult<()>;

    async fn get_all_club_ids(&self) -> ClubResult<Vec<ClubId>>;
}

#[async_trait::async_trait]
pub trait ReferralRepository: Send + Sync {
    async fn record_referral(
        &self,
        referrer_id: UserId,
        referred_id: UserId,
    ) -> Result<(), AppError>;
    async fn increment_hand_count_and_check_bonus(
        &self,
        referred_id: UserId,
    ) -> Result<bool, AppError>;
    async fn mark_bonus_awarded(&self, referred_id: UserId) -> Result<(), AppError>;
    async fn get_referrer_id(&self, referred_id: UserId) -> Result<Option<UserId>, AppError>;
    async fn get_referral_stats(&self, referrer_id: UserId) -> Result<ReferralStats, AppError>;
}

pub use UserRepository as UserRepo;

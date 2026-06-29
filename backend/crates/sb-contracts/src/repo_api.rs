use async_trait::async_trait;
use chrono::{DateTime, Utc};
use sb_shared_types::TableId;
use sb_shared_types::UserId;
use sb_shared_types::{ClubId, RequestContext};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

pub use crate::club_error::ClubError;
#[derive(Clone, Debug, Default, PartialEq, Eq, serde::Serialize, serde::Deserialize)]
pub struct ClubProSettings {
    pub banner_url: Option<String>,
    pub chip_preset_id: Option<i32>,
    pub felt_color: Option<String>,
}

pub use crate::persistence_error::{PersistenceError, PersistenceResult};

// ── Existing repository types ──────────────────────────────────

pub type HandCursor = (DateTime<Utc>, Uuid);
pub type HandSummaryPage = (Vec<HandSummary>, Option<HandCursor>);

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
pub trait UserRepo: Send + Sync {
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

    /// Transactional variant: uses the given connection instead of the writer loop.
    /// Used by tournament registration to keep everything in one ACID transaction.
    async fn update_chip_balance_with_conn(
        &self,
        conn: &sea_orm::DatabaseConnection,
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
    async fn is_club_pro_active(&self, user_id: UserId) -> PersistenceResult<bool>;

}

#[async_trait]
pub trait HandHistoryRepository: Send + Sync {
    /// Store a hand. The `participants` column is auto-populated from players JSON.
    async fn store_hand(
        &self,
        ctx: RequestContext,
        hand_data: serde_json::Value,
    ) -> PersistenceResult<()>;

    /// Keyset-based pagination. Returns (page, next_cursor).
    async fn list_hand_summaries(
        &self,
        ctx: RequestContext,
        table_id: TableId,
        limit: u64,
        cursor: Option<HandCursor>,
    ) -> PersistenceResult<HandSummaryPage>;

    /// Total count of hands for a table.
    async fn count_hand_histories(
        &self,
        ctx: RequestContext,
        table_id: TableId,
    ) -> PersistenceResult<u64>;

    /// Count hands a user has played at a table (for authorization).
    async fn count_user_hands(
        &self,
        ctx: RequestContext,
        table_id: TableId,
        user_id: UserId,
    ) -> PersistenceResult<u64>;
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

// ── Hand Summary (UPDATED) ──
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HandSummary {
    pub id: Uuid,
    pub table_id: TableId,
    pub played_at: DateTime<Utc>,
    pub pot: i64,
    pub winners: Vec<WinnerSummary>,
    // 🆕 New fields
    pub community_cards: Vec<String>, // e.g. ["As", "Kh", "Qd"]
    pub winner_hole_cards: Option<Vec<String>>, // only for the top winner
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WinnerSummary {
    pub user_id: UserId,
    pub amount: i64,
    pub hand_rank: String,
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
    async fn update_pro_settings(
        &self,
        club_id: ClubId,
        settings: ClubProSettings,
    ) -> Result<ClubProSettings, ClubError>;

    async fn find_club_owner(&self, club_id: ClubId) -> ClubResult<UserId>;
}

#[derive(Debug, Clone)]
pub struct ReferralStats {
    pub total_referred: i64,
    pub bonus_earned: i64,
    pub pending_bonus: i64,
}

#[async_trait]
pub trait ReferralRepository: Send + Sync {
    async fn record_referral(&self, referrer_id: UserId, referred_id: UserId) -> PersistenceResult<()>;
    async fn get_referral_stats(&self, user_id: UserId) -> PersistenceResult<ReferralStats>;
    async fn increment_hand_count_and_check_bonus(&self, referred_id: UserId) -> PersistenceResult<bool>;
    async fn mark_bonus_awarded(&self, referred_id: UserId) -> PersistenceResult<()>;
    async fn get_referrer_id(&self, referred_id: UserId) -> PersistenceResult<Option<UserId>>;
}


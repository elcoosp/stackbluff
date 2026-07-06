use crate::service_api::ReferralStats;
use async_trait::async_trait;
use chrono::{DateTime, Utc};
use sb_shared_types::TableId;
use sb_shared_types::{AppError, UserId};
use sb_shared_types::{ClubId, RequestContext};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

pub use crate::club_error::ClubError;
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

/// User with password hash for authentication (not exposed in UserProfile)
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct UserWithHash {
    pub id: UserId,
    pub password_hash: Option<String>,
    pub platform: String,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct UserProfile {
    pub id: UserId,
    pub display_name: String,
    pub email: Option<String>,
    pub chip_balance: i64,
    pub email_verified_at: Option<chrono::DateTime<chrono::Utc>>,
    pub platform: String,
    pub club_pro_expires_at: Option<chrono::DateTime<chrono::Utc>>,
    pub season_pass_id: Option<uuid::Uuid>,
    pub season_pass_expires_at: Option<chrono::DateTime<chrono::Utc>>,
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

    async fn has_active_season_pass(
        &self,
        ctx: RequestContext,
        user_id: UserId,
    ) -> Result<bool, PersistenceError>;

    /// Updates the user's chip balance by `delta`. Returns the new balance.
    async fn update_chip_balance(
        &self,
        ctx: RequestContext,
        user_id: UserId,
        delta: i64,
    ) -> PersistenceResult<i64>;

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

    async fn find_by_email_with_hash(
        &self,
        ctx: RequestContext,
        email: &str,
    ) -> PersistenceResult<Option<UserWithHash>>;
    async fn mark_email_verified(
        &self,
        ctx: RequestContext,
        user_id: UserId,
    ) -> PersistenceResult<()>;

    async fn update_password(
        &self,
        ctx: RequestContext,
        user_id: UserId,
        new_password_hash: &str,
    ) -> PersistenceResult<()>;

    /// Update password and set password_changed_at to current time
    /// This invalidates all existing JWTs issued before this timestamp
    async fn update_password_with_timestamp(
        &self,
        ctx: RequestContext,
        user_id: UserId,
        new_password_hash: &str,
    ) -> PersistenceResult<()>;

    async fn is_email_verified(
        &self,
        ctx: RequestContext,
        user_id: UserId,
    ) -> PersistenceResult<bool>;
}

#[async_trait]
pub trait HandHistoryRepository: Send + Sync {
    async fn store_hand(
        &self,
        ctx: RequestContext,
        hand_data: serde_json::Value,
    ) -> PersistenceResult<()>;

    async fn list_hand_summaries(
        &self,
        ctx: RequestContext,
        table_id: TableId,
        limit: u64,
        cursor: Option<HandCursor>,
    ) -> PersistenceResult<HandSummaryPage>;

    async fn count_hand_histories(
        &self,
        ctx: RequestContext,
        table_id: TableId,
    ) -> PersistenceResult<u64>;

    async fn count_user_hands(
        &self,
        ctx: RequestContext,
        table_id: TableId,
        user_id: UserId,
    ) -> PersistenceResult<u64>;
}

// ── Club domain types ────────────────────────────────────────

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct Club {
    pub id: ClubId,
    pub name: String,
    pub logo_url: Option<String>,
    pub created_by: UserId,
    pub telegram_chat_id: Option<i64>,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct ClubMembership {
    pub club_id: ClubId,
    pub user_id: UserId,
    pub weekly_xp: i64,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct LeaderboardEntry {
    pub rank: u32,
    pub user_id: UserId,
    pub weekly_xp: i64,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct LeaderboardPage {
    pub club_id: ClubId,
    pub division: u32,
    pub total_divisions: u32,
    pub total_members: u64,
    pub entries: Vec<LeaderboardEntry>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HandSummary {
    pub id: Uuid,
    pub table_id: TableId,
    pub played_at: DateTime<Utc>,
    pub pot: i64,
    pub winners: Vec<WinnerSummary>,
    pub community_cards: Vec<String>,
    pub winner_hole_cards: Option<Vec<String>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WinnerSummary {
    pub user_id: UserId,
    pub amount: i64,
    pub hand_rank: String,
}

pub const DIVISION_SIZE: u32 = 500;
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

    async fn get_telegram_chat_id(&self, club_id: ClubId) -> ClubResult<Option<i64>>;

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

    async fn update_club_pro_settings(
        &self,
        club_id: ClubId,
        settings: serde_json::Value,
    ) -> PersistenceResult<()>;

    async fn get_club_pro_settings(
        &self,
        club_id: ClubId,
    ) -> PersistenceResult<Option<serde_json::Value>>;

    async fn get_tables_by_club_id(&self, club_id: ClubId) -> PersistenceResult<Vec<TableId>>;

    async fn get_user_division(&self, club_id: ClubId, user_id: UserId) -> ClubResult<Option<u32>>;

    async fn rebalance_divisions(&self, club_id: ClubId) -> ClubResult<()>;

    async fn is_club_owner(&self, club_id: ClubId, user_id: UserId) -> ClubResult<bool>;
}

// ── Referral repository ───────────────────────────────────────

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

    // 🆕 ADD THIS METHOD
    async fn count_completed_referrals(
        &self,
        db: &impl sea_orm::ConnectionTrait,
        referrer_id: UserId,
    ) -> Result<i64, PersistenceError>;
}

// ── Badge repository ──────────────────────────────────────────

#[derive(Clone, Debug)]
pub struct BadgeRecord {
    pub user_id: UserId,
    pub badge_type: String,
    pub awarded_at: chrono::DateTime<chrono::Utc>,
}

#[async_trait]
pub trait BadgeRepo: Send + Sync {
    async fn award_badge(
        &self,
        user_id: UserId,
        badge_type: &str,
    ) -> Result<bool, PersistenceError>;
    async fn has_badge(&self, user_id: UserId, badge_type: &str) -> Result<bool, PersistenceError>;
    async fn list_badges(&self, user_id: UserId) -> Result<Vec<BadgeRecord>, PersistenceError>;
}

#[derive(Clone)]
pub struct NoopBadgeRepo;

#[async_trait::async_trait]
impl BadgeRepo for NoopBadgeRepo {
    async fn award_badge(
        &self,
        _user_id: UserId,
        _badge_type: &str,
    ) -> Result<bool, PersistenceError> {
        Ok(false)
    }
    async fn has_badge(
        &self,
        _user_id: UserId,
        _badge_type: &str,
    ) -> Result<bool, PersistenceError> {
        Ok(false)
    }
    async fn list_badges(&self, _user_id: UserId) -> Result<Vec<BadgeRecord>, PersistenceError> {
        Ok(vec![])
    }
}

// ── GDPR repository ────────────────────────────────────────────

#[async_trait::async_trait]
pub trait GdprRepo: Send + Sync {
    async fn request_deletion(&self, user_id: uuid::Uuid) -> Result<(), PersistenceError>;
    async fn get_pending_deletions(
        &self,
        older_than_days: i64,
    ) -> Result<Vec<DeletionRequestDto>, PersistenceError>;
    async fn mark_deletion_completed(&self, user_id: uuid::Uuid) -> Result<(), PersistenceError>;
    async fn get_user_data(
        &self,
        user_id: uuid::Uuid,
    ) -> Result<UserDataExportDto, PersistenceError>;
    async fn anonymize_user(&self, user_id: uuid::Uuid) -> Result<(), PersistenceError>;
    async fn invalidate_sessions(&self, user_id: uuid::Uuid) -> Result<(), PersistenceError>;
    async fn get_user_password_hash(&self, user_id: uuid::Uuid)
    -> Result<String, PersistenceError>;
}

#[derive(Clone, Debug)]
pub struct DeletionRequestDto {
    pub user_id: uuid::Uuid,
    pub requested_at: chrono::NaiveDateTime,
}

#[derive(Clone, Debug, serde::Serialize)]
pub struct UserDataExportDto {
    pub profile: serde_json::Value,
    pub hand_history: serde_json::Value,
    pub missions: serde_json::Value,
}

pub use UserRepository as UserRepo;

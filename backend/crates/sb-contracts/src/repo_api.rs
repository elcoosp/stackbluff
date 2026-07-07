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
    pub registration_order: Option<u64>,
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

    // ── NEW: find by telegram ID ──────────────────────────────
    async fn find_by_telegram(
        &self,
        ctx: RequestContext,
        tg_id: i64,
    ) -> PersistenceResult<Option<UserId>>;

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

// ... rest of file (ClubRepo, ReferralRepository, BadgeRepo, GdprRepo, etc.) unchanged ...

use async_trait::async_trait;
use chrono::{DateTime, Utc};
use sb_shared_types::RequestContext;
use sb_shared_types::{AppError, ChipAmount, HandRank, TableId, UserId};
use serde::{Deserialize, Serialize};

use crate::repo_api::UserProfile;
use crate::{ClubError, LeaderboardPage};
use sb_shared_types::game_types::GameVariant;
use sb_shared_types::{ClubId, StakeLevel};

/// Input for creating a new poker table.
#[derive(Debug, Clone)]
pub struct CreateTableInput {
    pub name: String,
    pub club_id: Option<ClubId>,
    pub stake_level: StakeLevel,
    pub variant: GameVariant,
    pub created_by: UserId,
    pub is_private: bool,
    pub invited_users: Vec<UserId>,
}

/// Service for managing poker tables.
#[async_trait::async_trait]
pub trait TableService: Send + Sync {
    async fn create_table(
        &self,
        ctx: &RequestContext,
        input: CreateTableInput,
    ) -> Result<TableId, AppError>;
}
#[derive(Debug, Clone)]
pub struct HandResult {
    pub hand_rank: HandRank,
    pub pot_size: ChipAmount,
    pub is_all_in: bool,
    pub is_tournament_ko: bool,
}

impl HandResult {
    pub fn is_significant(&self) -> bool {
        matches!(
            self.hand_rank,
            HandRank::StraightFlush | HandRank::FourOfAKind | HandRank::FullHouse
        ) || self.is_all_in
            || self.is_tournament_ko
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReplayCard {
    pub card_id: String,
    pub hand_description: String,
    pub winner_name: String,
    pub invite_link: String,
    pub timestamp: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReferralStats {
    pub total_referred: i64,
    pub bonus_earned: i64,
    pub pending_bonus: i64,
}

#[async_trait]
pub trait ViralService: Send + Sync {
    async fn generate_replay_card(
        &self,
        hand_result: &sb_shared_types::game_types::HandResult,
        winner_id: UserId,
        table_id: TableId,
    ) -> Result<ReplayCard, AppError>;
    async fn record_referral(
        &self,
        referrer_id: UserId,
        referred_id: UserId,
    ) -> Result<(), AppError>;
    async fn on_hand_completed(&self, user_id: UserId) -> Result<(), AppError>;
    async fn get_referral_stats(&self, user_id: UserId) -> Result<ReferralStats, AppError>;
}

#[async_trait]
pub trait UserService: Send + Sync {
    async fn award_chips(&self, user_id: UserId, amount: ChipAmount) -> Result<(), AppError>;
    async fn get_user_name(&self, user_id: UserId) -> Result<String, AppError>;
    async fn get_registration_order(&self, user_id: UserId) -> Result<Option<u64>, AppError>;
}

#[async_trait]
pub trait AntiCheatService: Send + Sync {
    async fn check_transfer(
        &self,
        from: UserId,
        to: UserId,
        amount: ChipAmount,
        ctx: &RequestContext,
    ) -> Result<(), AntiCheatError>;
    fn check_game_action_rate(&self, user_id: UserId) -> Result<(), AntiCheatError>;
    fn check_auth_rate(&self, ip: &str) -> Result<(), AntiCheatError>;
    async fn record_heads_up(
        &self,
        ip: &str,
        user1: UserId,
        user2: UserId,
        ctx: &RequestContext,
    ) -> Result<(), AntiCheatError>;
}

#[derive(Debug, thiserror::Error)]
pub enum AntiCheatError {
    #[error("Net transfer limit exceeded (max {0}/24h)")]
    TransferLimitExceeded(i64),
    #[error("Rate limit exceeded")]
    RateLimited,
    #[error("Database error: {0}")]
    Database(String),
    #[error("Internal error: {0}")]
    Internal(String),
    #[error("Self-transfer not allowed")]
    SelfTransfer,
}

#[async_trait::async_trait]
pub trait PaymentService: Send + Sync {
    async fn create_intent(
        &self,
        user_id: sb_shared_types::UserId,
        amount: sb_shared_types::ChipAmount,
        currency: String,
        provider: String,
        metadata: serde_json::Value,
    ) -> Result<String, sb_shared_types::AppError>;

    async fn confirm_payment(
        &self,
        payment_id: &str,
        provider: &str,
        status: &str,
        completed_at: Option<chrono::DateTime<chrono::Utc>>,
    ) -> Result<(), sb_shared_types::AppError>;

    async fn award_chips_on_success(
        &self,
        user_id: sb_shared_types::UserId,
        amount: sb_shared_types::ChipAmount,
    ) -> Result<(), sb_shared_types::AppError>;
}
#[async_trait]
pub trait OracleService: Send + Sync {
    type Params: Send + Sync;
    type Output: Send + Sync;
    type Error: std::error::Error + Send + Sync;

    /// Analyze a hand using the oracle heuristic engine.
    async fn analyze(
        &self,
        ctx: &RequestContext,
        params: Self::Params,
    ) -> Result<Self::Output, Self::Error>;

    /// Handle a callback query (no-op for oracle service, but required by the trait).
    async fn answer_callback_query(
        &self,
        callback_id: String,
        text: Option<String>,
    ) -> Result<(), Self::Error>;
}
#[async_trait::async_trait]
pub trait ClubService: Send + Sync {
    async fn create_club(
        &self,
        ctx: &sb_shared_types::RequestContext,
        name: &str,
        logo_url: Option<&str>,
        created_by: sb_shared_types::UserId,
    ) -> Result<sb_shared_types::ClubId, ClubError>;

    async fn join_club(
        &self,
        ctx: &sb_shared_types::RequestContext,
        club_id: sb_shared_types::ClubId,
        user_id: sb_shared_types::UserId,
    ) -> Result<(), ClubError>;

    async fn get_leaderboard(
        &self,
        ctx: &sb_shared_types::RequestContext,
        club_id: sb_shared_types::ClubId,
        division: u32,
    ) -> Result<LeaderboardPage, ClubError>;

    async fn add_xp(
        &self,
        ctx: &sb_shared_types::RequestContext,
        club_id: sb_shared_types::ClubId,
        user_id: sb_shared_types::UserId,
        xp: i64,
    ) -> Result<(), ClubError>;
}

// ========== Authentication contracts ==========

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuthResult {
    pub jwt: String,
    pub user_id: sb_shared_types::UserId,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TokenClaims {
    pub user_id: sb_shared_types::UserId,
    pub platform: String,
}

#[async_trait::async_trait]
pub trait AuthService: Send + Sync {
    async fn authenticate(
        &self,
        token: &str,
        ctx: &sb_shared_types::RequestContext,
    ) -> Result<sb_shared_types::UserId, sb_shared_types::AppError>;
    async fn telegram_auth(
        &self,
        ctx: &sb_shared_types::RequestContext,
        init_data: &str,
    ) -> Result<AuthResult, sb_shared_types::AppError>;
    async fn register(
        &self,
        ctx: &RequestContext,
        username: &str,
        email: &str,
        password: &str,
    ) -> Result<AuthResult, AppError>;
    async fn login(
        &self,
        ctx: &sb_shared_types::RequestContext,
        email: &str,
        password: &str,
    ) -> Result<AuthResult, sb_shared_types::AppError>;
    async fn verify_token(&self, token: &str) -> Result<TokenClaims, sb_shared_types::AppError>;

    async fn validate_token(
        &self,
        token: &str,
    ) -> Result<sb_shared_types::UserId, sb_shared_types::AppError>;

    async fn get_user_profile(
        &self,
        ctx: &sb_shared_types::RequestContext,
        user_id: sb_shared_types::UserId,
    ) -> Result<UserProfile, sb_shared_types::AppError>;
}

// ── Missions ──────────────────────────────────────────────────────────────
use sb_shared_types::missions::{Mission, MissionId};

#[derive(Debug, serde::Serialize)]
pub struct ClaimResult {
    pub chips_awarded: ChipAmount,
    pub streak_count: u32,
    pub weekly_bonus_awarded: bool,
}

#[async_trait::async_trait]
pub trait MissionApi: Send + Sync + 'static {
    async fn on_hand_completed(&self, ctx: &RequestContext, hand_result: &sb_shared_types::game_types::HandResult) -> Result<(), AppError>;
    async fn on_share_created(&self, ctx: &RequestContext, share_type: &str) -> Result<(), AppError>;
    async fn get_today_missions(&self, ctx: &RequestContext) -> Result<Vec<Mission>, AppError>;
    async fn reroll_mission(&self, ctx: &RequestContext, mission_id: MissionId) -> Result<Mission, AppError>;
    async fn claim_daily_reward(&self, ctx: &RequestContext) -> Result<ClaimResult, AppError>;
}

use async_trait::async_trait;
use chrono::{DateTime, Utc};
use sb_shared_types::{AppError, ChipAmount, HandRank, TableId, UserId};
use serde::{Deserialize, Serialize};
use sb_shared_types::RequestContext;

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
        hand_result: &HandResult,
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
    async fn check_transfer(&self, from: UserId, to: UserId, amount: ChipAmount, ctx: &RequestContext) -> Result<(), AntiCheatError>;
    fn check_game_action_rate(&self, user_id: UserId) -> Result<(), AntiCheatError>;
    fn check_auth_rate(&self, ip: &str) -> Result<(), AntiCheatError>;
    async fn record_heads_up(&self, ip: &str, user1: UserId, user2: UserId, ctx: &RequestContext) -> Result<(), AntiCheatError>;
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

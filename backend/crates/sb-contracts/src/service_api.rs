use async_trait::async_trait;
use chrono::{DateTime, Utc};
use sb_shared_types::{AppError, ChipAmount, HandRank, TableId, UserId};
use serde::{Deserialize, Serialize};

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

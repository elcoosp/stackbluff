pub mod metrics;

use async_trait::async_trait;
use chrono::Utc;
use sb_contracts::{
    HandCountObserver, ReplayCardObserver,
    repo_api::{BadgeRepo, ReferralRepository},
    service_api::{ReferralStats, ReplayCard, UserService, ViralService},

};
use sb_shared_types::{AppError, ChipAmount, TableId, UserId, game_types::HandResult};
use std::sync::Arc;
use tracing::{error, info};
use uuid::Uuid;

pub struct ViralServiceImpl<R: ReferralRepository, U: UserService, B: BadgeRepo = sb_contracts::repo_api::NoopBadgeRepo> {
    repo: Arc<R>,
    user_service: Arc<U>,
    badge_repo: Arc<B>,
    base_url: String,
}

impl<R: ReferralRepository, U: UserService> ViralServiceImpl<R, U> {
    pub fn new(repo: R, user_service: Arc<U>, base_url: String) -> Self {
        Self {
            repo: Arc::new(repo),
            user_service,
            badge_repo: Arc::new(sb_contracts::repo_api::NoopBadgeRepo),
            base_url,
        }
    }

    pub fn with_badge_repo<B2: BadgeRepo>(self, badge_repo: B2) -> ViralServiceImpl<R, U, B2> {
        ViralServiceImpl {
            repo: self.repo,
            user_service: self.user_service,
            badge_repo: Arc::new(badge_repo),
            base_url: self.base_url,
        }
    }

    async fn award_bonus(&self, user_id: UserId, is_triple: bool) -> Result<(), AppError> {
        let base_amount: i64 = 100;
        let amount = if is_triple {
            base_amount * 3
        } else {
            base_amount
        };
        let chip_amount = ChipAmount::new(amount)
            .ok_or_else(|| AppError::InvalidInput("Invalid chip amount".into()))?;
        self.user_service.award_chips(user_id, chip_amount).await?;
        info!(user_id = %user_id, triple = is_triple, "Awarded {} chips", amount);
        metrics::counter!("bonus_awarded", 1);
        Ok(())
    }
}

#[async_trait]
impl<R: ReferralRepository, U: UserService> ViralService for ViralServiceImpl<R, U> {
    async fn generate_replay_card(
        &self,
        hand_result: &HandResult,
        winner_id: UserId,
        _table_id: TableId,
    ) -> Result<ReplayCard, AppError> {
        let span = tracing::info_span!("generate_replay_card", winner_id = %winner_id);
        let _enter = span.enter();
        if !hand_result.went_to_showdown && !hand_result.hero_went_allin {
            return Err(AppError::InvalidInput("hand not significant".into()));
        }
        let winner_name = self.user_service.get_user_name(winner_id).await?;
        let card_id = Uuid::new_v4().to_string();
        let invite_link = format!("{}/?ref={}", self.base_url, winner_id);
        Ok(ReplayCard {
            card_id,
            hand_description: "Significant Hand".to_string(),
            winner_name,
            invite_link,
            timestamp: Utc::now(),
        })
    }

    async fn record_referral(
        &self,
        referrer_id: UserId,
        referred_id: UserId,
    ) -> Result<(), AppError> {
        let span = tracing::info_span!("record_referral", referrer_id = %referrer_id, referred_id = %referred_id);
        let _enter = span.enter();
        self.repo.record_referral(referrer_id, referred_id).await.map_err(|e| AppError::Internal(e.to_string()))
    }

    async fn on_hand_completed(&self, user_id: UserId) -> Result<(), AppError> {
        let span = tracing::info_span!("on_hand_completed", user_id = %user_id);
        let _enter = span.enter();
        let should_award = self
            .repo
            .increment_hand_count_and_check_bonus(user_id)
            .await.map_err(|e| AppError::Internal(e.to_string()))?;
        if !should_award {
            return Ok(());
        }
        let referrer_id = match self.repo.get_referrer_id(user_id).await.map_err(|e| AppError::Internal(e.to_string()))? {
            Some(id) => id,
            None => return Ok(()),
        };
        let order = self.user_service.get_registration_order(user_id).await?;
        let triple = order.is_some_and(|o| o <= 1000);
        self.award_bonus(user_id, triple).await?;
        self.award_bonus(referrer_id, triple).await?;
        self.repo.mark_bonus_awarded(user_id).await?;

        // Check and award founding member badge
        match self.repo.get_referral_stats(referrer_id).await {
            Ok(stats) if stats.bonus_earned >= 10 => {
                match self.badge_repo.award_badge(referrer_id, "founding_member").await {
                    Ok(true) => info!("Badge awarded: founding_member to {}", referrer_id),
                    Ok(false) => {}
                    Err(e) => error!("Failed to award badge: {}", e),
                }
            }
            _ => {}
        }


        info!(referred = %user_id, referrer = %referrer_id, triple = triple, "Referral bonus awarded after 5 hands");
        Ok(())
    }

    async fn get_referral_stats(&self, user_id: UserId) -> Result<ReferralStats, AppError> {
        self.repo.get_referral_stats(user_id).await.map_err(|e| AppError::Internal(e.to_string())).map(|s| ReferralStats { total_referred: s.total_referred, bonus_earned: s.bonus_earned, pending_bonus: s.pending_bonus })
    }
}

#[async_trait]
impl<R: ReferralRepository + Send + Sync, U: UserService + Send + Sync> ReplayCardObserver
    for ViralServiceImpl<R, U>
{
    async fn on_significant_hand(
        &self,
        hand_result: &HandResult,
        winner_id: UserId,
        table_id: TableId,
    ) {
        if let Err(e) = self
            .generate_replay_card(hand_result, winner_id, table_id)
            .await
        {
            error!(error = %e, "Failed to generate replay card");
        }
    }
}

#[async_trait]
impl<R: ReferralRepository + Send + Sync, U: UserService + Send + Sync> HandCountObserver
    for ViralServiceImpl<R, U>
{
    async fn on_hand_completed(&self, user_id: UserId) {
        if let Err(e) = ViralService::on_hand_completed(self, user_id).await {
            error!(error = %e, "Failed to process hand completion for referrals");
        }
    }
}
pub mod puzzle;


use async_trait::async_trait;
use sea_orm::DatabaseTransaction;
use sb_contracts::badge_repo_api::{BadgeEngine, BadgeRepo, BadgeRepoError, BadgeType};
use sb_contracts::repo_api::ReferralRepository;
use sb_shared_types::ids::UserId;
use std::sync::Arc;
use tracing::{info, instrument};

pub struct BadgeEngineImpl<R, B> {
    referral_repo: Arc<R>,
    badge_repo: Arc<B>,
}

impl<R, B> BadgeEngineImpl<R, B> {
    pub fn new(referral_repo: Arc<R>, badge_repo: Arc<B>) -> Self {
        Self { referral_repo, badge_repo }
    }
}

#[async_trait]
impl<R, B> BadgeEngine for BadgeEngineImpl<R, B>
where
    R: ReferralRepository + 'static,
    B: BadgeRepo + 'static,
{
    #[instrument(skip(self, txn), fields(referrer_id = %referrer_id.0), err)]
    async fn check_founding_member(
        &self,
        txn: &DatabaseTransaction,
        referrer_id: UserId,
    ) -> Result<bool, BadgeRepoError> {
        let count = self
            .referral_repo
            .count_completed_referrals(txn, referrer_id)
            .await
            .map_err(|e| BadgeRepoError::Transaction(e.to_string()))?;

        if count < 10 {
            return Ok(false);
        }

        let awarded = self
            .badge_repo
            .award_badge(txn, referrer_id, BadgeType::FoundingMember)
            .await?;

        if awarded {
            info!(referrer_id = %referrer_id.0, "founding_member badge awarded");
        }
        Ok(awarded)
    }
}

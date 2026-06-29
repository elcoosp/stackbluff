use sb_contracts::repo_api::ReferralRepository;
use sb_shared_types::{AppError, UserId};

const FOUNDING_MEMBER_THRESHOLD: i64 = 10;
const FOUNDING_MEMBER_BADGE: &str = "founding_member";

/// Check if a referrer should get the founding member badge after a referral bonus is awarded.
/// This should be called from `increment_hand_count_and_award` in referral.rs after bonus is awarded.
pub async fn check_and_award_founding_member<R>(
    referral_repo: &R,
    referred_id: UserId,
) -> Result<bool, AppError>
where
    R: ReferralRepository,
{
    let referrer_id = referral_repo
        .get_referrer_id(referred_id)
        .await
        .map_err(|e| AppError::Internal(e.to_string()))?;

    let Some(referrer_id) = referrer_id else {
        return Ok(false);
    };

    // count_completed_referrals needs a db connection - we can't easily call it here
    // without one. The check should happen inside the referral repo transaction.
    // For now, return false and document that the check should be in the repo layer.
    // Actually, let's look at what the repo provides...

    // The ReferralRepository::get_referral_stats gives us bonus_earned count
    let stats = referral_repo
        .get_referral_stats(referrer_id)
        .await
        .map_err(|e| AppError::Internal(e.to_string()))?;

    if stats.bonus_earned >= FOUNDING_MEMBER_THRESHOLD {
        // We would need a BadgeRepo here to award. This is a design issue.
        // The badge award should happen in the db-repos layer where both
        // referral_repo and badge_repo have db access.
        tracing::info!(
            "User {} has {} completed referrals, threshold {} for founding_member",
            referrer_id,
            stats.bonus_earned,
            FOUNDING_MEMBER_THRESHOLD
        );
        return Ok(true);
    }

    Ok(false)
}

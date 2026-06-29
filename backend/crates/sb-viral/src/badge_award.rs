use sb_contracts::repo_api::{BadgeRepo, ReferralRepository};
use sb_shared_types::{AppError, UserId};

const FOUNDING_MEMBER_THRESHOLD: i64 = 10;
const FOUNDING_MEMBER_BADGE: &str = "founding_member";

/// Check if a referrer should get the founding member badge after a referral bonus is awarded.
/// Call this from `increment_hand_count_and_award` in referral.rs after the bonus is awarded.
pub async fn check_and_award_founding_member<R, B>(
    referral_repo: &R,
    badge_repo: &B,
    referred_id: UserId,
) -> Result<bool, AppError>
where
    R: ReferralRepository,
    B: BadgeRepo,
{
    let referrer_id = referral_repo
        .get_referrer_id(referred_id)
        .await
        .map_err(|e| AppError::Internal(e.to_string()))?;

    let Some(referrer_id) = referrer_id else {
        return Ok(false);
    };

    let completed = referral_repo
        .count_completed_referrals(&badge_repo, referrer_id)
        .await
        .map_err(|e| AppError::Internal(e.to_string()))?;

    if completed >= FOUNDING_MEMBER_THRESHOLD {
        let newly_awarded = badge_repo
            .award_badge(referrer_id, FOUNDING_MEMBER_BADGE)
            .await
            .map_err(|e| AppError::Internal(e.to_string()))?;

        if newly_awarded {
            tracing::info!("User {} awarded founding_member badge", referrer_id);
        }
        return Ok(newly_awarded);
    }

    Ok(false)
}

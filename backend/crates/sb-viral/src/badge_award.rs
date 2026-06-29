use sb_contracts::repo_api::ReferralRepository;
use sb_shared_types::{AppError, UserId};

const FOUNDING_MEMBER_THRESHOLD: i64 = 10;

/// Check if a referrer should get the founding member badge after a referral bonus is awarded.
/// This should be called from the db-repos layer where both referral and badge repos have
/// database access. The viral service layer does not have direct badge repo access.
pub async fn check_founding_member_eligibility<R>(
    referral_repo: &R,
    referred_id: UserId,
) -> Result<Option<UserId>, AppError>
where
    R: ReferralRepository,
{
    let referrer_id = referral_repo
        .get_referrer_id(referred_id)
        .await
        .map_err(|e| AppError::Internal(e.to_string()))?;

    let Some(referrer_id) = referrer_id else {
        return Ok(None);
    };

    let stats = referral_repo
        .get_referral_stats(referrer_id)
        .await
        .map_err(|e| AppError::Internal(e.to_string()))?;

    if stats.bonus_earned >= FOUNDING_MEMBER_THRESHOLD {
        return Ok(Some(referrer_id));
    }

    Ok(None)
}

use crate::ViralServiceImpl;
use sb_contracts::service_api::ReferralStats;
use sb_db_entities::{prelude::*, referral, system_counter};
use sb_shared_types::{AppError, UserId};
use sea_orm::{ActiveModelTrait, ColumnTrait, DatabaseConnection, EntityTrait, IntoActiveModel, QueryFilter, Set};
use tracing::info;

pub async fn record_referral(db: &DatabaseConnection, referrer_id: UserId, referred_id: UserId) -> Result<(), AppError> {
    let new_ref = referral::ActiveModel {
        referrer_id: Set(referrer_id.to_string()),
        referred_id: Set(referred_id.to_string()),
        hand_count: Set(0),
        bonus_awarded: Set(false),
        created_at: Set(chrono::Utc::now().into()),
        ..Default::default()
    };
    Referral::insert(new_ref).exec(db).await.map_err(|e| AppError::Database(e.to_string()))?;
    info!("Referral recorded: {:?} -> {:?}", referrer_id, referred_id);
    Ok(())
}

pub async fn increment_hand_count_and_award(db: &DatabaseConnection, user_id: UserId, svc: &ViralServiceImpl) -> Result<(), AppError> {
    let referral_opt = Referral::find()
        .filter(referral::Column::ReferredId.eq(user_id.to_string()))
        .one(db)
        .await
        .map_err(|e| AppError::Database(e.to_string()))?;
    let Some(ref_model) = referral_opt else { return Ok(()) };
    let mut active: referral::ActiveModel = ref_model.clone().into_active_model();
    let new_count = ref_model.hand_count + 1;
    active.hand_count = Set(new_count);
    if new_count >= 5 && !ref_model.bonus_awarded {
        let reg_order = get_user_registration_order(db, &user_id).await?;
        let triple = reg_order <= 1000;
        svc.award_bonus(user_id, triple).await?;
        let referrer_id = UserId::try_from(ref_model.referrer_id.clone())
            .map_err(|_| AppError::InvalidInput("invalid referrer id".into()))?;
        svc.award_bonus(referrer_id, triple).await?;
        active.bonus_awarded = Set(true);
        info!("Bonus awarded for referral after 5 hands: referred={:?}, referrer={:?}", user_id, referrer_id);
    }
    active.update(db).await.map_err(|e| AppError::Database(e.to_string()))?;
    Ok(())
}

async fn get_user_registration_order(db: &DatabaseConnection, user_id: &UserId) -> Result<u64, AppError> {
    use system_counter::Column;
    let counter = SystemCounter::find()
        .filter(Column::Name.eq("global_user_count"))
        .one(db)
        .await
        .map_err(|e| AppError::Database(e.to_string()))?;
    Ok(counter.map(|c| c.value as u64).unwrap_or(0))
}

pub async fn get_stats(db: &DatabaseConnection, user_id: UserId) -> Result<ReferralStats, AppError> {
    let referrals = Referral::find()
        .filter(referral::Column::ReferrerId.eq(user_id.to_string()))
        .all(db)
        .await
        .map_err(|e| AppError::Database(e.to_string()))?;
    let total_referred = referrals.len() as i64;
    let bonus_earned = referrals.iter().filter(|r| r.bonus_awarded).count() as i64;
    let pending_bonus = referrals.iter().filter(|r| r.hand_count >= 5 && !r.bonus_awarded).count() as i64;
    Ok(ReferralStats { total_referred, bonus_earned, pending_bonus })
}

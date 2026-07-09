use axum::{
    Json, Router,
    extract::{Extension, State},
    http::StatusCode,
    routing::get,
};
use sb_shared_types::RequestContext;
use serde::Serialize;
use std::sync::Arc;

#[derive(Serialize)]
pub struct ReferralStatsResponse {
    pub total_referred: i64,
    pub bonus_earned: i64,
    pub pending_bonus: i64,
}

#[derive(Serialize)]
pub struct ReferralRecordResponse {
    pub referred_id: String,
    pub display_name: Option<String>,
    pub hand_count: i32,
    pub bonus_awarded: bool,
    pub created_at: chrono::DateTime<chrono::Utc>,
}

pub fn referral_routes() -> Router<Arc<crate::AppState>> {
    Router::new()
        .route("/referrals/stats", get(get_referral_stats))
        .route("/referrals/list", get(get_referral_list))
}

async fn get_referral_stats(
    Extension(ctx): Extension<RequestContext>,
    State(state): State<Arc<crate::AppState>>,
) -> Result<Json<ReferralStatsResponse>, (StatusCode, String)> {
    let user_id = ctx
        .user_id
        .ok_or((StatusCode::UNAUTHORIZED, "Unauthorized".to_string()))?;
    let stats = state
        .viral_service
        .get_referral_stats(user_id)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
    Ok(Json(ReferralStatsResponse {
        total_referred: stats.total_referred,
        bonus_earned: stats.bonus_earned,
        pending_bonus: stats.pending_bonus,
    }))
}

async fn get_referral_list(
    Extension(ctx): Extension<RequestContext>,
    State(state): State<Arc<crate::AppState>>,
) -> Result<Json<Vec<ReferralRecordResponse>>, (StatusCode, String)> {
    let user_id = ctx
        .user_id
        .ok_or((StatusCode::UNAUTHORIZED, "Unauthorized".to_string()))?;
    let records = state
        .viral_service
        .get_referral_list(user_id)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
    let response: Vec<ReferralRecordResponse> = records
        .into_iter()
        .map(|r| ReferralRecordResponse {
            referred_id: r.referred_id.to_string(),
            display_name: r.display_name,
            hand_count: r.hand_count,
            bonus_awarded: r.bonus_awarded,
            created_at: r.created_at,
        })
        .collect();
    Ok(Json(response))
}

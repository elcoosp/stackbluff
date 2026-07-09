use axum::{
    Router,
    extract::{Extension, State},
    http::StatusCode,
    response::Json,
    routing::get,
};
use std::sync::Arc;
use uuid::Uuid;

use sb_auth::middleware::AuthUser;
use sb_contracts::service_api::{ReferralStats, ViralService};
use sb_shared_types::UserId;
use serde::Serialize;

use crate::{AppState, ErrorResponse, internal_error, bad_request};

#[derive(Serialize)]
pub struct ReferralRecord {
    pub referred_id: String,
    pub display_name: Option<String>,
    pub hand_count: i32,
    pub bonus_awarded: bool,
    pub created_at: chrono::DateTime<chrono::Utc>,
}

pub fn referral_routes() -> Router<Arc<AppState>> {
    Router::new()
        .route("/referrals/stats", get(get_referral_stats))
        .route("/referrals/list", get(get_referral_list))
}

async fn get_referral_stats(
    Extension(auth_user): Extension<AuthUser>,
    State(state): State<Arc<AppState>>,
) -> Result<Json<ReferralStats>, (StatusCode, Json<ErrorResponse>)> {
    let user_id = UserId::new(
        Uuid::parse_str(&auth_user.user_id)
            .map_err(|_| bad_request("INVALID_USER", "Invalid user ID"))?,
    );

    let stats = state
        .viral_service
        .get_referral_stats(user_id)
        .await
        .map_err(|e| internal_error(e))?;

    Ok(Json(stats))
}

async fn get_referral_list(
    Extension(auth_user): Extension<AuthUser>,
    State(state): State<Arc<AppState>>,
) -> Result<Json<Vec<ReferralRecord>>, (StatusCode, Json<ErrorResponse>)> {
    let user_id = UserId::new(
        Uuid::parse_str(&auth_user.user_id)
            .map_err(|_| bad_request("INVALID_USER", "Invalid user ID"))?,
    );

    let records = state
        .viral_service
        .get_referral_list(user_id)
        .await
        .map_err(|e| internal_error(e))?;

    // Convert to the response type
    let response: Vec<ReferralRecord> = records
        .into_iter()
        .map(|r| ReferralRecord {
            referred_id: r.referred_id.to_string(),
            display_name: r.display_name,
            hand_count: r.hand_count,
            bonus_awarded: r.bonus_awarded,
            created_at: r.created_at,
        })
        .collect();

    Ok(Json(response))
}

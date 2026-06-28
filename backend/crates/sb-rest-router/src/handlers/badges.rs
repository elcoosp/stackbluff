use crate::AppState;
use axum::{
    Json,
    extract::{Path, State},
};
use sb_contracts::badge_repo_api::{BadgeRepo, BadgeType};
use sb_shared_types::ids::UserId;
use std::sync::Arc;

#[derive(serde::Serialize)]
pub struct BadgeResponse {
    pub badge_type: String,
    pub awarded_at: Option<String>,
}

#[derive(serde::Serialize)]
pub struct BadgesListResponse {
    pub badges: Vec<BadgeResponse>,
    pub founding_member_progress: Option<FoundingMemberProgress>,
}

#[derive(serde::Serialize)]
pub struct FoundingMemberProgress {
    pub completed: u64,
    pub required: u64,
}

pub async fn get_my_badges(
    State(state): State<Arc<AppState>>,
    axum::Extension(auth_user): axum::Extension<sb_auth::middleware::AuthUser>,
) -> Result<Json<BadgesListResponse>, (axum::http::StatusCode, String)> {
    let user_id = UserId::new(uuid::Uuid::parse_str(&auth_user.user_id).map_err(|_| {
        (
            axum::http::StatusCode::BAD_REQUEST,
            "Invalid user ID".to_string(),
        )
    })?);

    let badges = state
        .badge_repo
        .list_badges(user_id)
        .await
        .map_err(|e| (axum::http::StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let mut response = BadgesListResponse {
        badges: badges
            .iter()
            .map(|b| BadgeResponse {
                badge_type: b.as_str().to_string(),
                awarded_at: None,
            })
            .collect(),
        founding_member_progress: None,
    };

    if !badges.contains(&BadgeType::FoundingMember) {
        if let Ok(count) = state.referral_repo.count_completed_referrals(user_id).await {
            response.founding_member_progress = Some(FoundingMemberProgress {
                completed: count,
                required: 10,
            });
        }
    }

    Ok(Json(response))
}

pub async fn get_user_badges(
    State(state): State<Arc<AppState>>,
    Path(user_id): Path<String>,
) -> Result<Json<BadgesListResponse>, (axum::http::StatusCode, String)> {
    let uid = UserId::new(uuid::Uuid::parse_str(&user_id).map_err(|_| {
        (
            axum::http::StatusCode::BAD_REQUEST,
            "Invalid user ID".to_string(),
        )
    })?);

    let badges = state
        .badge_repo
        .list_badges(uid)
        .await
        .map_err(|e| (axum::http::StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(Json(BadgesListResponse {
        badges: badges
            .iter()
            .map(|b| BadgeResponse {
                badge_type: b.as_str().to_string(),
                awarded_at: None,
            })
            .collect(),
        founding_member_progress: None,
    }))
}

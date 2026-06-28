use axum::{
    extract::{Path, State},
    Json,
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

pub async fn get_my_badges<B: BadgeRepo>(
    State(badge_repo): State<Arc<B>>,
    axum::Extension(user_id): axum::Extension<UserId>,
) -> Json<BadgesListResponse> {
    let badges = badge_repo.list_badges(user_id).await.unwrap_or_default();

    let mut response = BadgesListResponse {
        badges: badges
            .into_iter()
            .map(|b| BadgeResponse {
                badge_type: b.as_str().to_string(),
                awarded_at: None,
            })
            .collect(),
        founding_member_progress: None,
    };

    Json(response)
}

pub async fn get_user_badges<B: BadgeRepo>(
    State(badge_repo): State<Arc<B>>,
    Path(user_id): Path<uuid::Uuid>,
) -> Json<BadgesListResponse> {
    let uid = UserId::new(user_id);
    let badges = badge_repo.list_badges(uid).await.unwrap_or_default();

    Json(BadgesListResponse {
        badges: badges
            .into_iter()
            .map(|b| BadgeResponse {
                badge_type: b.as_str().to_string(),
                awarded_at: None,
            })
            .collect(),
        founding_member_progress: None,
    })
}

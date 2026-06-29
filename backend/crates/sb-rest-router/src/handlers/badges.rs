use axum::{
    extract::{Extension, Path, State},
    http::StatusCode,
    response::Json,
    routing::get,
    Router,
};
use sb_contracts::repo_api::BadgeRepo;
use sb_shared_types::ids::UserId;
use serde::Serialize;
use std::sync::Arc;
use uuid::Uuid;

#[derive(Serialize)]
struct BadgeResponse {
    badge_type: String,
    awarded_at: String,
}

#[derive(Serialize)]
struct BadgeListResponse {
    badges: Vec<BadgeResponse>,
}

pub async fn get_my_badges<B: BadgeRepo>(
    State(badge_repo): State<Arc<B>>,
    Extension(auth_user): Extension<sb_auth::middleware::AuthUser>,
) -> Result<Json<BadgeListResponse>, StatusCode> {
    let user_id = UserId::new(
        Uuid::parse_str(&auth_user.user_id)
            .map_err(|_| StatusCode::BAD_REQUEST)?,
    );

    let badges = badge_repo
        .list_badges(user_id)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(Json(BadgeListResponse {
        badges: badges.into_iter().map(|b| BadgeResponse {
            badge_type: b.badge_type,
            awarded_at: b.awarded_at.to_rfc3339(),
        }).collect(),
    }))
}

pub async fn get_user_badges<B: BadgeRepo>(
    State(badge_repo): State<Arc<B>>,
    Path(user_id): Path<Uuid>,
) -> Result<Json<BadgeListResponse>, StatusCode> {
    let badges = badge_repo
        .list_badges(UserId::new(user_id))
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(Json(BadgeListResponse {
        badges: badges.into_iter().map(|b| BadgeResponse {
            badge_type: b.badge_type,
            awarded_at: b.awarded_at.to_rfc3339(),
        }).collect(),
    }))
}

pub fn badge_routes<B: BadgeRepo + Clone + Send + Sync + 'static>() -> Router {
    Router::new()
        .route("/users/me/badges", get(get_my_badges::<B>))
        .route("/users/{user_id}/badges", get(get_user_badges::<B>))
}

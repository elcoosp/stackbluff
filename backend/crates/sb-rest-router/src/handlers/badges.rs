use axum::{
    extract::{Extension, Path, State},
    http::StatusCode,
    response::Json,
};
use sb_contracts::repo_api::BadgeRepo;
use sb_contracts::persistence_error::PersistenceError;
use sb_shared_types::ids::UserId;
use serde::Serialize;
use std::sync::Arc;
use uuid::Uuid;
use crate::AppState;

#[derive(Serialize)]
struct BadgeResponse {
    badge_type: String,
    awarded_at: String,
}

#[derive(Serialize)]
struct BadgeListResponse {
    badges: Vec<BadgeResponse>,
}

#[derive(Serialize)]
struct ErrorResponse {
    error: String,
}

fn map_persistence_error(e: PersistenceError) -> (StatusCode, Json<ErrorResponse>) {
    match e {
        PersistenceError::NotFound => (
            StatusCode::NOT_FOUND,
            Json(ErrorResponse { error: "User not found".to_string() }),
        ),
        PersistenceError::UniqueViolation => (
            StatusCode::CONFLICT,
            Json(ErrorResponse { error: "Badge already exists".to_string() }),
        ),
        PersistenceError::InvalidData(msg) => (
            StatusCode::BAD_REQUEST,
            Json(ErrorResponse { error: msg }),
        ),
        PersistenceError::Database(msg) => {
            tracing::error!(error = %msg, "Database error in badge handler");
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(ErrorResponse { error: "Internal server error".to_string() }),
            )
        }
    }
}

pub async fn get_my_badges(
    State(state): State<Arc<AppState>>,
    Extension(auth_user): Extension<sb_auth::middleware::AuthUser>,
) -> Result<Json<BadgeListResponse>, (StatusCode, Json<ErrorResponse>)> {
    let user_id = UserId::new(
        Uuid::parse_str(&auth_user.user_id)
            .map_err(|_| (
                StatusCode::BAD_REQUEST,
                Json(ErrorResponse { error: "Invalid user ID".to_string() }),
            ))?,
    );

    let badges = state
        .badge_repo
        .list_badges(user_id)
        .await
        .map_err(map_persistence_error)?;

    Ok(Json(BadgeListResponse {
        badges: badges.into_iter().map(|b| BadgeResponse {
            badge_type: b.badge_type,
            awarded_at: b.awarded_at.to_rfc3339(),
        }).collect(),
    }))
}

pub async fn get_user_badges(
    State(state): State<Arc<AppState>>,
    Path(user_id): Path<Uuid>,
) -> Result<Json<BadgeListResponse>, (StatusCode, Json<ErrorResponse>)> {
    let badges = state
        .badge_repo
        .list_badges(UserId::new(user_id))
        .await
        .map_err(map_persistence_error)?;

    Ok(Json(BadgeListResponse {
        badges: badges.into_iter().map(|b| BadgeResponse {
            badge_type: b.badge_type,
            awarded_at: b.awarded_at.to_rfc3339(),
        }).collect(),
    }))
}

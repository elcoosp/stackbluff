use axum::{
    extract::{Path, State},
    http::StatusCode,
    Json,
};
use sb_contracts::ClubService;
use sb_shared_types::ClubId;
use std::sync::Arc;

use crate::models::{
    CreateClubRequest, CreateClubResponse, GetLeaderboardResponse, JoinClubResponse,
};

/// Shared state for the club router.
#[derive(Clone)]
pub struct ClubState {
    pub service: Arc<dyn ClubService>,
}

/// `POST /clubs` — create a new club.
pub async fn create_club(
    State(state): State<ClubState>,
    Json(req): Json<CreateClubRequest>,
) -> Result<(StatusCode, Json<CreateClubResponse>), (StatusCode, String)> {
    // TODO: extract user_id from auth middleware / request context
    // TODO: extract user_id from auth middleware / request context
    let user_id = sb_shared_types::UserId(uuid::Uuid::parse_str("00000000-0000-0000-0000-000000000001").unwrap());

    let club_id = state
        .service
        .create_club(&req.name, req.logo_url.as_deref(), user_id)
        .await
        .map_err(|e: sb_contracts::PersistenceError| match e {
            sb_contracts::PersistenceError::ValidationError(msg) => {
                (StatusCode::BAD_REQUEST, msg)
            }
            _ => (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()),
        })?;

    Ok((StatusCode::CREATED, Json(CreateClubResponse { club_id })))
}

/// `POST /clubs/{club_id}/join` — join a club.
pub async fn join_club(
    State(state): State<ClubState>,
    Path(club_id): Path<ClubId>,
) -> Result<Json<JoinClubResponse>, (StatusCode, String)> {
    // TODO: extract user_id from auth middleware / request context
    // TODO: extract user_id from auth middleware / request context
    let user_id = sb_shared_types::UserId(uuid::Uuid::parse_str("00000000-0000-0000-0000-000000000001").unwrap());

    state
        .service
        .join_club(club_id, user_id)
        .await
        .map_err(|e: sb_contracts::PersistenceError| match e {
            sb_contracts::PersistenceError::ClubNotFound => {
                (StatusCode::NOT_FOUND, "club not found".into())
            }
            sb_contracts::PersistenceError::AlreadyMember => {
                (StatusCode::CONFLICT, "already a member".into())
            }
            _ => (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()),
        })?;

    Ok(Json(JoinClubResponse { success: true }))
}

/// `GET /clubs/{club_id}/leaderboard` — get leaderboard (defaults to division 1).
pub async fn get_leaderboard(
    State(state): State<ClubState>,
    Path(club_id): Path<ClubId>,
) -> Result<Json<GetLeaderboardResponse>, (StatusCode, String)> {
    let page = state
        .service
        .get_leaderboard(club_id, 1)
        .await
        .map_err(|e: sb_contracts::PersistenceError| match e {
            sb_contracts::PersistenceError::ClubNotFound => {
                (StatusCode::NOT_FOUND, "club not found".into())
            }
            _ => (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()),
        })?;

    Ok(Json(GetLeaderboardResponse::from(page)))
}

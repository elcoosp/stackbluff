use axum::{
    extract::{Path, State},
    http::StatusCode,
    Extension, Json,
};
use sb_contracts::ClubService;
use sb_shared_types::{ClubId, RequestContext, UserId};
use std::sync::Arc;
use uuid::Uuid;

use crate::models::{
    CreateClubRequest, CreateClubResponse, GetLeaderboardResponse, JoinClubResponse,
};

/// Shared state for the club router.
#[derive(Clone)]
pub struct ClubState {
    pub service: Arc<dyn ClubService>,
}

/// Extract authenticated user_id from the RequestContext extension.
/// Returns 401 if no user is authenticated.
fn extract_user_id(ctx: &RequestContext) -> Result<UserId, (StatusCode, String)> {
    ctx.user_id.ok_or_else(|| {
        (StatusCode::UNAUTHORIZED, "authentication required".to_string())
    })
}

/// `POST /clubs` — create a new club.
pub async fn create_club(
    State(state): State<ClubState>,
    Extension(ctx): Extension<RequestContext>,
    Json(req): Json<CreateClubRequest>,
) -> Result<(StatusCode, Json<CreateClubResponse>), (StatusCode, String)> {
    let user_id = extract_user_id(&ctx)?;

    let club_id = state
        .service
        .create_club(&ctx, &req.name, req.logo_url.as_deref(), user_id)
        .await
        .map_err(|e| map_club_error(e))?;

    Ok((StatusCode::CREATED, Json(CreateClubResponse { club_id })))
}

/// `POST /clubs/{club_id}/join` — join a club.
pub async fn join_club(
    State(state): State<ClubState>,
    Extension(ctx): Extension<RequestContext>,
    Path(club_id): Path<ClubId>,
) -> Result<Json<JoinClubResponse>, (StatusCode, String)> {
    let user_id = extract_user_id(&ctx)?;

    state
        .service
        .join_club(&ctx, club_id, user_id)
        .await
        .map_err(|e| map_club_error(e))?;

    Ok(Json(JoinClubResponse { success: true }))
}

/// `GET /clubs/{club_id}/leaderboard` — get leaderboard (defaults to division 1).
pub async fn get_leaderboard(
    State(state): State<ClubState>,
    Extension(ctx): Extension<RequestContext>,
    Path(club_id): Path<ClubId>,
) -> Result<Json<GetLeaderboardResponse>, (StatusCode, String)> {
    let page = state
        .service
        .get_leaderboard(&ctx, club_id, 1)
        .await
        .map_err(|e| map_club_error(e))?;

    Ok(Json(GetLeaderboardResponse::from(page)))
}

/// Map ClubError to HTTP status codes with descriptive messages.
fn map_club_error(e: sb_contracts::ClubError) -> (StatusCode, String) {
    match e {
        sb_contracts::ClubError::NotFound { .. } => (StatusCode::NOT_FOUND, e.to_string()),
        sb_contracts::ClubError::AlreadyMember { .. } => (StatusCode::CONFLICT, e.to_string()),
        sb_contracts::ClubError::NotAMember { .. } => (StatusCode::FORBIDDEN, e.to_string()),
        sb_contracts::ClubError::Validation { .. } => (StatusCode::BAD_REQUEST, e.to_string()),
        sb_contracts::ClubError::Database { .. } => {
            tracing::error!(error = %e, "club database error");
            (StatusCode::INTERNAL_SERVER_ERROR, "internal error".to_string())
        }
    }
}

use axum::{
    Extension, Json,
    extract::{Path, State},
    http::StatusCode,
};
use sb_contracts::{ClubError, ClubService};
use sb_shared_types::{ClubId, RequestContext, UserId};
use std::sync::Arc;

use crate::models::{
    CreateClubRequest, CreateClubResponse, GetLeaderboardResponse, GetUserDivisionResponse,
    JoinClubResponse, RebalanceResponse,
};

#[derive(Clone)]
pub struct ClubState {
    pub service: Arc<dyn ClubService>,
}

fn extract_user_id(ctx: &RequestContext) -> Result<UserId, (StatusCode, String)> {
    ctx.user_id.ok_or_else(|| {
        (
            StatusCode::UNAUTHORIZED,
            "authentication required".to_string(),
        )
    })
}

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
        .map_err(map_club_error)?;

    Ok((StatusCode::CREATED, Json(CreateClubResponse { club_id })))
}

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
        .map_err(map_club_error)?;

    Ok(Json(JoinClubResponse { success: true }))
}

#[derive(serde::Deserialize)]
pub struct LeaderboardQuery {
    pub division: Option<u32>,
}

pub async fn get_leaderboard(
    State(state): State<ClubState>,
    Extension(ctx): Extension<RequestContext>,
    Path(club_id): Path<ClubId>,
    axum::extract::Query(query): axum::extract::Query<LeaderboardQuery>,
) -> Result<Json<GetLeaderboardResponse>, (StatusCode, String)> {
    let division = query.division.unwrap_or(1);
    let page = state
        .service
        .get_leaderboard(&ctx, club_id, division)
        .await
        .map_err(map_club_error)?;

    Ok(Json(GetLeaderboardResponse::from(page)))
}

pub async fn get_user_division(
    State(state): State<ClubState>,
    Extension(ctx): Extension<RequestContext>,
    Path(club_id): Path<ClubId>,
) -> Result<Json<GetUserDivisionResponse>, (StatusCode, String)> {
    let user_id = extract_user_id(&ctx)?;

    let division = state
        .service
        .get_user_division(&ctx, club_id, user_id)
        .await
        .map_err(map_club_error)?;

    Ok(Json(GetUserDivisionResponse { division }))
}

pub async fn rebalance_divisions(
    State(state): State<ClubState>,
    Extension(ctx): Extension<RequestContext>,
    Path(club_id): Path<ClubId>,
) -> Result<Json<RebalanceResponse>, (StatusCode, String)> {
    // TODO: Check if user is club owner before allowing rebalance

    state
        .service
        .rebalance_divisions(&ctx, club_id)
        .await
        .map_err(map_club_error)?;

    Ok(Json(RebalanceResponse { success: true }))
}
fn map_club_error(e: ClubError) -> (StatusCode, String) {
    match e {
        ClubError::NotFound => (StatusCode::NOT_FOUND, e.to_string()),
        ClubError::AlreadyMember => (StatusCode::CONFLICT, e.to_string()),
        ClubError::NotAMember => (StatusCode::FORBIDDEN, e.to_string()),
        ClubError::Validation { .. } => (StatusCode::BAD_REQUEST, e.to_string()),
        ClubError::PermissionDenied => (StatusCode::FORBIDDEN, e.to_string()),
        ClubError::InvalidOperation => (StatusCode::BAD_REQUEST, e.to_string()),
        ClubError::Database { .. } | ClubError::Internal { .. } => {
            tracing::error!(error = %e, "club database/internal error");
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                "internal error".to_string(),
            )
        }
    }
}

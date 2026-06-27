use axum::{
    Extension, Json,
    extract::{Path, State},
    http::StatusCode,
};
use sb_contracts::{ClubError, ClubService};
use sb_shared_types::{ClubId, RequestContext, UserId};
use std::sync::Arc;

use crate::models::{
    CreateClubRequest, CreateClubResponse, GetLeaderboardResponse, JoinClubResponse,
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

pub async fn get_leaderboard(
    State(state): State<ClubState>,
    Extension(ctx): Extension<RequestContext>,
    Path(club_id): Path<ClubId>,
) -> Result<Json<GetLeaderboardResponse>, (StatusCode, String)> {
    let page = state
        .service
        .get_leaderboard(&ctx, club_id, 1)
        .await
        .map_err(map_club_error)?;

    Ok(Json(GetLeaderboardResponse::from(page)))
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

/// POST /clubs/{club_id}/tournaments
pub async fn create_club_tournament(
    axum::extract::State(state): axum::extract::State<crate::AppState>,
    axum::extract::Path(club_id): axum::extract::Path<i64>,
    axum::Json(req): axum::Json<CreateClubTournamentRequest>,
) -> Result<axum::Json<CreateClubTournamentResponse>, sb_shared_types::errors::AppError> {
    let club_id = sb_shared_types::ids::ClubId(club_id);
    let user_id = req.requester_user_id;

    let config = sb_contracts::tournament_api::TournamentConfig {
        name: req.name,
        max_players: req.max_players,
        buy_in: req.buy_in,
        starting_chips: req.starting_chips.unwrap_or(req.buy_in * 10),
        blind_levels: req.blind_schedule,
        payout_structure: req.payout_structure,
        club_id: Some(club_id),
        scheduled_start: req.scheduled_start,
        blind_schedule_id: None,
    };

    let tournament_id = state
        .club_service
        .schedule_tournament(club_id, user_id, config)
        .await?;

    Ok(axum::Json(CreateClubTournamentResponse {
        tournament_id,
    }))
}

/// GET /clubs/{club_id}/tournaments
pub async fn list_club_tournaments(
    axum::extract::State(state): axum::extract::State<crate::AppState>,
    axum::extract::Path(club_id): axum::extract::Path<i64>,
) -> Result<axum::Json<Vec<sb_contracts::tournament_api::TournamentSummary>>, sb_shared_types::errors::AppError> {
    let club_id = sb_shared_types::ids::ClubId(club_id);
    let tournaments = state.club_service.list_club_tournaments(club_id).await?;
    Ok(axum::Json(tournaments))
}

#[derive(serde::Deserialize)]
pub struct CreateClubTournamentRequest {
    pub requester_user_id: i64,
    pub name: String,
    pub max_players: u32,
    pub buy_in: i64,
    pub starting_chips: Option<i64>,
    pub scheduled_start: Option<chrono::DateTime<chrono::Utc>>,
    pub blind_schedule: Vec<sb_contracts::tournament_api::BlindLevel>,
    pub payout_structure: sb_contracts::tournament_api::PayoutStructure,
}

#[derive(serde::Serialize)]
pub struct CreateClubTournamentResponse {
    pub tournament_id: uuid::Uuid,
}

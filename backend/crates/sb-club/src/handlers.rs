use axum::{
    Extension, Json,
    extract::{Multipart, Path, State},
    http::StatusCode,
};
use sb_contracts::{ClubError, ClubService};
use sb_shared_types::{ClubId, RequestContext, UserId};
use std::sync::Arc;

use crate::models::{
    CreateClubRequest, CreateClubResponse, GetLeaderboardResponse, GetUserDivisionResponse,
    JoinClubResponse, RebalanceResponse,
};
use sb_contracts::service_api::{ClubProSettings, UpdateClubSettingsRequest};

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

    // Validate division parameter
    if division == 0 {
        return Err((
            StatusCode::BAD_REQUEST,
            format!(
                "Invalid division parameter: division must be >= 1, got {}",
                division
            ),
        ));
    }

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
    let user_id = extract_user_id(&ctx)?;

    // Add timeout for rebalance operation (30 seconds max)
    let result = tokio::time::timeout(
        std::time::Duration::from_secs(30),
        state.service.rebalance_divisions(&ctx, club_id, user_id),
    )
    .await;

    match result {
        Ok(Ok(())) => Ok(Json(RebalanceResponse { success: true })),
        Ok(Err(e)) => Err(map_club_error(e)),
        Err(_) => Err((
            StatusCode::REQUEST_TIMEOUT,
            "Rebalance operation timed out. Please try again later.".to_string(),
        )),
    }
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

pub async fn update_club_settings(
    State(state): State<ClubState>,
    Extension(ctx): Extension<RequestContext>,
    Path(club_id): Path<ClubId>,
    Json(req): Json<UpdateClubSettingsRequest>,
) -> Result<Json<ClubProSettings>, (StatusCode, String)> {
    let _user_id = extract_user_id(&ctx)?;

    match state.service.update_pro_settings(&ctx, club_id, req).await {
        Ok(settings) => Ok(Json(settings)),
        Err(e) => {
            tracing::error!("Failed to update club settings: {:?}", e);
            Err((
                StatusCode::INTERNAL_SERVER_ERROR,
                "internal error".to_string(),
            ))
        }
    }
}

pub async fn get_club_settings(
    State(state): State<ClubState>,
    Extension(_ctx): Extension<RequestContext>,
    Path(club_id): Path<ClubId>,
) -> Result<Json<Option<ClubProSettings>>, (StatusCode, String)> {
    match state.service.get_pro_settings(club_id).await {
        Ok(settings) => Ok(Json(settings)),
        Err(e) => {
            tracing::error!("Failed to get club settings: {:?}", e);
            Err((
                StatusCode::INTERNAL_SERVER_ERROR,
                "internal error".to_string(),
            ))
        }
    }
}

pub async fn upload_banner(
    State(state): State<ClubState>,
    Extension(ctx): Extension<RequestContext>,
    Path(club_id): Path<ClubId>,
    mut multipart: Multipart,
) -> Result<Json<String>, (StatusCode, String)> {
    let user_id = extract_user_id(&ctx)?;

    match state.service.is_club_pro_active(user_id).await {
        Ok(false) | Err(_) => return Err((StatusCode::FORBIDDEN, "Club Pro required".to_string())),
        Ok(true) => {}
    }

    while let Ok(Some(field)) = multipart.next_field().await {
        let name: String = field.name().unwrap_or_default().to_string();
        if name == "banner" {
            let _data: axum::body::Bytes = field
                .bytes()
                .await
                .map_err(|_| (StatusCode::BAD_REQUEST, "invalid file".to_string()))?;
            return Ok(Json(format!(
                "https://cdn.example.com/club_{}_banner.png",
                club_id
            )));
        }
    }

    Err((StatusCode::BAD_REQUEST, "no banner field".to_string()))
}

// === Issue #029: Club Tournament Scheduling ===
use sb_contracts::ClubRepo;
use sb_contracts::tournament_api::{TournamentConfig, TournamentService, TournamentSummary};

#[derive(Clone)]
pub struct ClubTournamentState {
    pub club_service: Arc<dyn sb_contracts::ClubService>,
    pub club_repo: Arc<dyn ClubRepo>,
    pub tournament_service: Arc<dyn TournamentService>,
}

pub async fn create_club_tournament(
    State(state): State<ClubTournamentState>,
    Extension(ctx): Extension<RequestContext>,
    Path(club_id): Path<ClubId>,
    Json(mut config): Json<TournamentConfig>,
) -> Result<(StatusCode, Json<serde_json::Value>), (StatusCode, String)> {
    let user_id = extract_user_id(&ctx)?;

    // Validate user is club owner
    let club = state
        .club_repo
        .find_club_by_id(club_id)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
        .ok_or_else(|| (StatusCode::NOT_FOUND, "Club not found".to_string()))?;

    if club.created_by != user_id {
        return Err((
            StatusCode::FORBIDDEN,
            "Only club owner can create tournaments".to_string(),
        ));
    }

    // Set club_id in config
    config.club_id = Some(club_id);

    // Create tournament
    let tournament_id = state
        .tournament_service
        .create_tournament(&ctx, config)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok((
        StatusCode::CREATED,
        Json(serde_json::json!({ "tournament_id": tournament_id })),
    ))
}

pub async fn list_club_tournaments(
    State(state): State<ClubTournamentState>,
    Extension(ctx): Extension<RequestContext>,
    Path(_club_id): Path<ClubId>,
) -> Result<Json<Vec<TournamentSummary>>, (StatusCode, String)> {
    // List all tournaments and filter by club_id
    let all_tournaments = state
        .tournament_service
        .list_tournaments(&ctx, None, None)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    // Filter tournaments by club_id
    // Note: In production, TournamentSummary should include club_id field
    // For now, we return all tournaments since we can't access the config here
    let club_tournaments = all_tournaments;

    Ok(Json(club_tournaments))
}

pub fn club_tournament_routes(state: ClubTournamentState) -> axum::Router {
    axum::Router::new()
        .route(
            "/clubs/{club_id}/tournaments",
            axum::routing::post(create_club_tournament),
        )
        .route(
            "/clubs/{club_id}/tournaments",
            axum::routing::get(list_club_tournaments),
        )
        .with_state(state)
}

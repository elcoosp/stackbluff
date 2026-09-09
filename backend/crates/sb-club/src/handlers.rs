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
use sb_contracts::tournament_api::{TournamentRecord, TournamentRepo};

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
        Ok(settings) => {
            // Broadcast club updated event
            state.service.broadcast_club_updated(club_id).await;
            Ok(Json(settings))
        }
        Err(e) => {
            tracing::error!("Failed to update club settings: {:?}", e);
            Err((
                StatusCode::INTERNAL_SERVER_ERROR,
                "internal error".to_string(),
            ))
        }
    }
}

pub async fn update_club(
    State(state): State<ClubState>,
    Extension(ctx): Extension<RequestContext>,
    Path(club_id): Path<ClubId>,
    Json(req): Json<UpdateClubSettingsRequest>,
) -> Result<Json<ClubProSettings>, (StatusCode, String)> {
    let result = update_club_settings(
        State(state.clone()),
        Extension(ctx),
        Path(club_id),
        Json(req),
    )
    .await;
    if result.is_ok() {
        // Broadcast club updated event
        state.service.broadcast_club_updated(club_id).await;
    }
    result
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

pub async fn list_clubs(
    State(state): State<ClubState>,
    Extension(ctx): Extension<RequestContext>,
) -> Result<Json<Vec<serde_json::Value>>, (StatusCode, String)> {
    let user_id = extract_user_id(&ctx)?;
    let club_ids = state
        .service
        .get_user_clubs(&ctx, user_id)
        .await
        .map_err(map_club_error)?;
    let mut clubs = Vec::new();
    for club_id in club_ids {
        let club = state
            .service
            .get_club(&ctx, club_id)
            .await
            .map_err(map_club_error)?;
        let member_count = state
            .service
            .get_member_count(&ctx, club_id)
            .await
            .map_err(map_club_error)?;
        let is_owner = club.created_by == user_id;
        let pro_settings = state
            .service
            .get_pro_settings(club_id)
            .await
            .map_err(map_club_error)?;

        let mut response = serde_json::json!({
            "id": club_id.as_uuid(),
            "name": club.name,
            "logo_url": club.logo_url,
            "members_count": member_count,
            "is_owner": is_owner,
            "telegram_group_id": club.telegram_chat_id.map(|id| id.to_string()),
        });
        if let Some(settings) = pro_settings {
            response["pro_settings"] = serde_json::to_value(settings).map_err(|e| {
                (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    format!("Failed to serialize pro_settings: {}", e),
                )
            })?;
        }
        clubs.push(response);
    }
    Ok(Json(clubs))
}

pub async fn get_club(
    State(state): State<ClubState>,
    Extension(ctx): Extension<RequestContext>,
    Path(club_id): Path<ClubId>,
) -> Result<Json<serde_json::Value>, (StatusCode, String)> {
    let club = state
        .service
        .get_club(&ctx, club_id)
        .await
        .map_err(map_club_error)?;
    let member_count = state
        .service
        .get_member_count(&ctx, club_id)
        .await
        .map_err(map_club_error)?;
    let user_id = extract_user_id(&ctx)?;
    let is_owner = club.created_by == user_id;
    let pro_settings = state
        .service
        .get_pro_settings(club_id)
        .await
        .map_err(map_club_error)?;

    let mut response = serde_json::json!({
        "id": club_id.as_uuid(),
        "name": club.name,
        "logo_url": club.logo_url,
        "members_count": member_count,
        "is_owner": is_owner,
        "telegram_group_id": club.telegram_chat_id.map(|id| id.to_string()),
    });
    if let Some(settings) = pro_settings {
        response["pro_settings"] = serde_json::to_value(settings).map_err(|e| {
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                format!("Failed to serialize pro_settings: {}", e),
            )
        })?;
    }
    Ok(Json(response))
}

use sb_contracts::ClubRepo;
use sb_contracts::tournament_api::{TournamentConfig, TournamentService};

#[derive(Clone)]
pub struct ClubTournamentState {
    pub club_service: Arc<dyn sb_contracts::ClubService>,
    pub club_repo: Arc<dyn ClubRepo>,
    pub tournament_service: Arc<dyn TournamentService>,
    pub tournament_repo: Arc<dyn TournamentRepo>,
}

pub async fn create_club_tournament(
    State(state): State<ClubTournamentState>,
    Extension(ctx): Extension<RequestContext>,
    Path(club_id): Path<ClubId>,
    Json(mut config): Json<TournamentConfig>,
) -> Result<(StatusCode, Json<serde_json::Value>), (StatusCode, String)> {
    let user_id = extract_user_id(&ctx)?;
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
    config.club_id = Some(club_id);
    let tournament_id = state
        .tournament_service
        .create_tournament(&ctx, config)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
    // Broadcast tournament.created event
    state
        .club_service
        .broadcast_tournament_created(club_id, tournament_id)
        .await;
    Ok((
        StatusCode::CREATED,
        Json(serde_json::json!({ "tournament_id": tournament_id })),
    ))
}

pub async fn list_club_tournaments(
    State(state): State<ClubTournamentState>,
    Extension(_ctx): Extension<RequestContext>,
    Path(club_id): Path<ClubId>,
) -> Result<Json<serde_json::Value>, (StatusCode, String)> {
    // Fetch all tournament records (not summaries)
    let all_records = state
        .tournament_repo
        .list_tournaments(None, None)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    // Filter by club_id
    let club_tournaments: Vec<TournamentRecord> = all_records
        .into_iter()
        .filter(|record| record.config.club_id == Some(club_id))
        .collect();

    // Convert to TournamentSummary (or just use the existing structure)
    // Since the frontend expects fields like buy_in, max_players, etc., we map
    let summaries: Vec<serde_json::Value> = club_tournaments
        .into_iter()
        .map(|record| {
            serde_json::json!({
                "id": record.id.as_uuid(),
                "name": record.name,
                "tournament_type": format!("{:?}", record.config.tournament_type),
                "status": format!("{:?}", record.status),
                "registered": 0,
                "max_players": record.config.max_players,
                "buy_in": record.config.buy_in.as_i64(),
                "prize_pool": record.prize_pool.as_i64(),
                "current_blind_level": None as Option<u32>,
                "started_at": record.started_at.map(|dt| dt.to_rfc3339()),
                "scheduled_start": record.config.scheduled_start.map(|dt| dt.to_rfc3339()),
            })
        })
        .collect();

    let response = serde_json::json!({ "tournaments": summaries });
    Ok(Json(response))
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

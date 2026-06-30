use axum::{
    Extension, Json,
    extract::{Path, State},
    http::StatusCode,
};
use sb_contracts::{ClubError, ClubService};
use sb_shared_types::{ClubId, RequestContext, UserId};
use std::sync::Arc;

use crate::models::{
use sb_contracts::service_api::{ClubProSettings, UpdateClubSettingsRequest};
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

pub async fn update_club_settings(
    State(service): State<Arc<dyn ClubService>>,
    Extension(ctx): Extension<RequestContext>,
    Path(club_id): Path<ClubId>,
    Json(req): Json<UpdateClubSettingsRequest>,
) -> Result<Json<ClubProSettings>, StatusCode> {
    match service.update_pro_settings(&ctx, club_id, req).await {
        Ok(settings) => Ok(Json(settings)),
        Err(e) => {
            tracing::error("Failed to update club settings: {:?}", e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

pub async fn get_club_settings(
    State(service): State<Arc<dyn ClubService>>,
    Path(club_id): Path<ClubId>,
) -> Result<Json<Option<ClubProSettings>>, StatusCode> {
    match service.get_pro_settings(club_id).await {
        Ok(settings) => Ok(Json(settings)),
        Err(e) => {
            tracing::error("Failed to get club settings: {:?}", e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

pub async fn upload_banner(
    State(service): State<Arc<dyn ClubService>>,
    Extension(ctx): Extension<RequestContext>,
    Path(club_id): Path<ClubId>,
    mut multipart: Multipart,
) -> Result<Json<String>, StatusCode> {
    let user_id = ctx.user_id.unwrap_or_default();
    match service.is_club_pro_active(user_id).await {
        Ok(false) | Err(_) => return Err(StatusCode::FORBIDDEN),
        Ok(true) => {}
    }
    
    while let Some(field) = multipart.next_field().await.unwrap() {
        let name = field.name().unwrap_or_default().to_string();
        if name == "banner" {
            let _data = field.bytes().await.map_err(|_| StatusCode::BAD_REQUEST)?;
            return Ok(Json(format!("https://cdn.example.com/club_{}_banner.png", club_id)));
        }
    }
    
    Err(StatusCode::BAD_REQUEST)
}
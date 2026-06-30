use axum::{
    Extension, Json,
    extract::{Multipart, Path, State},
    http::StatusCode,
};
use sb_contracts::{ClubError, ClubService};
use sb_contracts::service_api::{ClubProSettings, UpdateClubSettingsRequest};
use sb_shared_types::{AppError, ClubId, RequestContext, UserId};
use std::sync::Arc;

use crate::models::{
    CreateClubRequest, CreateClubResponse,
};

pub async fn create_club(
    State(service): State<Arc<dyn ClubService>>,
    Extension(ctx): Extension<RequestContext>,
    Json(req): Json<CreateClubRequest>,
) -> Result<Json<CreateClubResponse>, StatusCode> {
    todo!()
}

pub async fn update_club_settings(
    State(service): State<Arc<dyn ClubService>>,
    Extension(ctx): Extension<RequestContext>,
    Path(club_id): Path<ClubId>,
    Json(req): Json<UpdateClubSettingsRequest>,
) -> Result<Json<ClubProSettings>, StatusCode> {
    match service.update_pro_settings(ctx, club_id, req).await {
        Ok(settings) => Ok(Json(settings)),
        Err(AppError::Unauthorized(msg)) => {
            tracing::warn!("Unauthorized club settings update: {}", msg);
            Err(StatusCode::FORBIDDEN)
        }
        Err(AppError::InvalidInput(msg)) => {
            tracing::warn!("Invalid club settings: {}", msg);
            Err(StatusCode::BAD_REQUEST)
        }
        Err(e) => {
            tracing::error!("Failed to update club settings: {:?}", e);
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
            tracing::error!("Failed to get club settings: {:?}", e);
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
    match service.is_club_pro_active(ctx.user_id).await {
        Ok(false) | Err(_) => return Err(StatusCode::FORBIDDEN),
        Ok(true) => {}
    }

    while let Some(field) = multipart.next_field().await.unwrap() {
        let name = field.name().unwrap_or_default().to_string();
        if name == "banner" {
            let data = field.bytes().await.map_err(|_| StatusCode::BAD_REQUEST)?;
            return Ok(Json(format!("https://cdn.example.com/club_{}_banner.png", club_id)));
        }
    }

    Err(StatusCode::BAD_REQUEST)
}

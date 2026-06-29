use axum::{
    Router,
    extract::{Extension, Path, State},
    http::StatusCode,
    response::Json,
    routing::{patch, post},
};
use sb_auth::middleware::AuthUser;
use sb_shared_types::club_pro_settings::UpdateClubProSettingsRequest;
use sb_shared_types::{ClubId, UserId};
use std::sync::Arc;
use uuid::Uuid;

use crate::{AppState, ErrorResponse, bad_request, forbidden, internal_error};

pub fn club_routes() -> Router<Arc<AppState>> {
    Router::new()
        .route("/clubs/{club_id}/settings", patch(update_club_settings))
        .route("/clubs/{club_id}/banner", post(upload_club_banner))
}

#[axum::debug_handler]
async fn update_club_settings(
    Extension(auth_user): Extension<AuthUser>,
    State(state): State<Arc<AppState>>,
    Path(club_id): Path<ClubId>,
    Json(req): Json<UpdateClubProSettingsRequest>,
) -> Result<Json<sb_contracts::repo_api::ClubProSettings>, (StatusCode, Json<ErrorResponse>)> {
    let user_id = UserId::new(
        Uuid::parse_str(&auth_user.user_id)
            .map_err(|_| (StatusCode::BAD_REQUEST, Json(ErrorResponse {
                error: crate::ErrorDetail {
                    code: "INVALID_USER".to_string(),
                    message: "Invalid user ID".to_string(),
                },
            })))?,
    );

    let settings = state
        .club_service
        .update_club_pro_settings(club_id, user_id, req)
        .await
        .map_err(|e| match e {
            sb_contracts::ClubError::PermissionDenied => forbidden("Club Pro subscription required"),
            _ => internal_error(e),
        })?;

    Ok(Json(settings))
}


#[axum::debug_handler]
async fn upload_club_banner(
    Extension(auth_user): Extension<AuthUser>,
    State(state): State<Arc<AppState>>,
    Path(club_id): Path<ClubId>,
    mut multipart: axum::extract::Multipart,
) -> Result<Json<serde_json::Value>, (StatusCode, Json<ErrorResponse>)> {
    let user_id = UserId::new(
        Uuid::parse_str(&auth_user.user_id)
            .map_err(|_| (StatusCode::BAD_REQUEST, Json(ErrorResponse {
                error: crate::ErrorDetail {
                    code: "INVALID_USER".to_string(),
                    message: "Invalid user ID".to_string(),
                },
            })))?,
    );

    // Verify ownership & Pro status
    let club_owner = state.club_service.find_club_owner(club_id).await
        .map_err(internal_error)?;
    if club_owner != user_id {
        return Err(forbidden("Only the club owner can upload a banner"));
    }

    let is_pro = state.club_service.is_club_pro_active(user_id).await
        .map_err(internal_error)?;
    if !is_pro {
        return Err(forbidden("Club Pro subscription required"));
    }

    // Extract file from multipart
    let mut file_data: Vec<u8> = Vec::new();
    let mut file_name = String::new();
    while let Some(field) = multipart.next_field().await
        .map_err(|e| bad_request("MULTIPART_ERROR", &e.to_string()))?
    {
        let name: String = field.name().unwrap_or("").to_string();
        if name == "banner" {
            file_name = field.file_name().unwrap_or("banner.png").to_string();
            let bytes: axum::body::Bytes = field.bytes().await
                .map_err(|e| bad_request("UPLOAD_ERROR", &e.to_string()))?;
            file_data = bytes.to_vec();
            break;
        }
    }

    if file_data.is_empty() {
        return Err(bad_request("NO_FILE", "No banner file provided"));
    }

    // Upload to R2 (reusing RealR2 pattern)
    let key = format!("club_banners/{}/{}", club_id.as_uuid(), file_name);
    // For MVP, we return a placeholder URL. In production, wire RealR2 here.
    let banner_url = format!("https://cdn.stackbluff.com/{}", key);

    // Update settings with new banner URL
    let req = UpdateClubProSettingsRequest {
        banner_url: Some(banner_url.clone()),
        chip_preset_id: None,
        felt_color: None,
    };
    let _ = state.club_service.update_club_pro_settings(club_id, user_id, req).await
        .map_err(|e| match e {
            sb_contracts::ClubError::PermissionDenied => forbidden("Club Pro subscription required"),
            _ => internal_error(e),
        })?;

    Ok(Json(serde_json::json!({ "banner_url": banner_url })))
}

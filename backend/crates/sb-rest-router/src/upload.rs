use axum::{
    Router,
    extract::{Multipart, State},
    http::StatusCode,
    response::Json,
    routing::post,
};
use sb_auth::middleware::AuthUser;
use serde_json::json;
use std::sync::Arc;
use uuid::Uuid;

use crate::AppState;

const MAX_FILE_SIZE: usize = 10 * 1024 * 1024; // 10MB

pub async fn upload_file(
    State(_state): State<Arc<AppState>>,
    _auth_user: AuthUser,
    mut multipart: Multipart,
) -> Result<Json<serde_json::Value>, (StatusCode, String)> {
    let mut file_name = String::new();
    let mut file_data: Option<Vec<u8>> = None;

    while let Ok(Some(field)) = multipart.next_field().await {
        let name = field.name().unwrap_or("").to_string();
        if name == "file" {
            file_name = field.file_name().unwrap_or("upload").to_string();
            let data = field.bytes().await
                .map_err(|e| (StatusCode::BAD_REQUEST, format!("Failed to read file: {}", e)))?;
            if data.len() > MAX_FILE_SIZE {
                return Err((StatusCode::BAD_REQUEST, "File too large (max 10MB)".to_string()));
            }
            file_data = Some(data.to_vec());
            break;
        }
    }

    let _data = file_data.ok_or((StatusCode::BAD_REQUEST, "No file provided".to_string()))?;

    // For now, return a dummy URL. Real R2 integration will be added later.
    let dummy_url = format!("https://cdn.stackbluff.com/uploads/{}/{}.bin", Uuid::new_v4(), file_name);

    Ok(Json(json!({ "url": dummy_url })))
}

pub fn router() -> Router<Arc<AppState>> {
    Router::new().route("/api/upload", post(upload_file))
}

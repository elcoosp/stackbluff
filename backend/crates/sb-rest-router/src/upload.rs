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
    State(state): State<Arc<AppState>>,
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

    let data = file_data.ok_or((StatusCode::BAD_REQUEST, "No file provided".to_string()))?;

    // Determine content type from file extension
    let ext = std::path::Path::new(&file_name)
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("bin");
    let content_type = match ext.to_lowercase().as_str() {
        "png" => "image/png",
        "jpg" | "jpeg" => "image/jpeg",
        "gif" => "image/gif",
        "webp" => "image/webp",
        "svg" => "image/svg+xml",
        _ => "application/octet-stream",
    };

    // Generate a unique key (including a timestamp prefix for good measure)
    let key = format!("uploads/{}/{}", Uuid::new_v4(), file_name);

    // Upload to R2 using the adapter
    let url = state.r2.put_object("uploads", &key, data, content_type)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(Json(json!({ "url": url })))
}

pub fn router() -> Router<Arc<AppState>> {
    Router::new().route("/api/upload", post(upload_file))
}

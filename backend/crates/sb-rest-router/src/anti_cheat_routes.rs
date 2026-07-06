use axum::{
    extract::{ConnectInfo, Json, State},
    http::StatusCode,
    response::IntoResponse,
};
use sb_anti_cheat::{FingerprintRepository, SeaFingerprintRepository};
use sb_auth::middleware::AuthUser;
use sb_shared_types::UserId;
use sea_orm::DatabaseConnection;
use serde::{Deserialize, Serialize};
use std::net::SocketAddr;
use uuid::Uuid;

#[derive(Debug, Deserialize)]
pub struct FingerprintRequest {
    pub fingerprint_hash: String,
}

#[derive(Debug, Serialize)]
pub struct FingerprintResponse {
    pub status: String,
}

pub async fn submit_fingerprint(
    State(db): State<DatabaseConnection>,
    user: AuthUser,
    ConnectInfo(addr): ConnectInfo<SocketAddr>,
    Json(req): Json<FingerprintRequest>,
) -> impl IntoResponse {
    let ip = addr.ip().to_string();
    let repo = SeaFingerprintRepository { db };

    // Parse the JWT user_id string into a proper UserId
    let user_id = match Uuid::parse_str(&user.user_id) {
        Ok(uid) => UserId::new(uid),
        Err(_) => {
            return Err((
                StatusCode::BAD_REQUEST,
                "Invalid user ID format".to_string(),
            ));
        }
    };

    match repo.upsert(user_id, req.fingerprint_hash, ip).await {
        Ok(_) => Ok((
            StatusCode::OK,
            Json(FingerprintResponse {
                status: "ok".to_string(),
            }),
        )),
        Err(e) => Err((StatusCode::INTERNAL_SERVER_ERROR, e.to_string())),
    }
}

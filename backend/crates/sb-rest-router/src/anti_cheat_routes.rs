use axum::{
    extract::{ConnectInfo, State, Json},
    http::StatusCode,
    response::IntoResponse,
};
use serde::{Deserialize, Serialize};
use sb_auth::AuthUser;
use sea_orm::DatabaseConnection;
use std::net::SocketAddr;
use sb_anti_cheat::repository::{FingerprintRepository, SeaFingerprintRepository};

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

    match repo.upsert(user.id, req.fingerprint_hash, ip).await {
        Ok(_) => Ok((StatusCode::OK, Json(FingerprintResponse { status: "ok".to_string() }))),
        Err(e) => Err((StatusCode::INTERNAL_SERVER_ERROR, e.to_string())),
    }
}

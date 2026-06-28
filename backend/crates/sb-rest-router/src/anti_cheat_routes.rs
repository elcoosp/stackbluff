use axum::{
    extract::{State, Json},
    http::StatusCode,
    response::IntoResponse,
};
use serde::{Deserialize, Serialize};
use sb_auth::AuthUser;
use sb_db_entities::entities::device_fingerprints;
use sea_orm::{ActiveModelTrait, DatabaseConnection, EntityTrait, Set};

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
    Json(req): Json<FingerprintRequest>,
) -> impl IntoResponse {
    // TODO: extract real IP from request extensions
    let ip = "127.0.0.1".to_string();

    let existing = device_fingerprints::Entity::find()
        .filter(device_fingerprints::Column::UserId.eq(user.id))
        .filter(device_fingerprints::Column::FingerprintHash.eq(&req.fingerprint_hash))
        .one(&db)
        .await;

    match existing {
        Ok(Some(record)) => {
            let mut active: device_fingerprints::ActiveModel = record.into();
            active.ip = Set(ip);
            active.created_at = Set(chrono::Utc::now().naive_utc());
            active.update(&db).await.map_err(|e| {
                (StatusCode::INTERNAL_SERVER_ERROR, e.to_string())
            })?;
        }
        Ok(None) => {
            let new = device_fingerprints::ActiveModel {
                user_id: Set(user.id),
                fingerprint_hash: Set(req.fingerprint_hash),
                ip: Set(ip),
                created_at: Set(chrono::Utc::now().naive_utc()),
                ..Default::default()
            };
            new.insert(&db).await.map_err(|e| {
                (StatusCode::INTERNAL_SERVER_ERROR, e.to_string())
            })?;
        }
        Err(e) => {
            return Err((StatusCode::INTERNAL_SERVER_ERROR, e.to_string()));
        }
    }

    Ok((StatusCode::OK, Json(FingerprintResponse { status: "ok".to_string() })))
}

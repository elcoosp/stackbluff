use axum::{
    extract::{Extension, State},
    http::StatusCode,
    response::Json,
    routing::{get, post},
    Router,
};
use serde::{Deserialize, Serialize};
use sb_auth::middleware::AuthUser;
use sb_db_repos::push_subscription_repo::{PushSubscriptionRepo, PushSubscriptionRepoImpl};
use sb_shared_types::UserId;
use sea_orm::DatabaseConnection;
use std::sync::Arc;

pub struct NotificationState {
    pub db: DatabaseConnection,
    pub vapid_public_key: String,
}

#[derive(Deserialize)]
pub struct SubscribeRequest {
    pub endpoint: String,
    pub keys: Keys,
    pub expiration_time: Option<i64>,
}

#[derive(Deserialize)]
pub struct Keys {
    pub p256dh: String,
    pub auth: String,
}

#[derive(Deserialize)]
pub struct UnsubscribeRequest {
    pub endpoint: String,
}

#[derive(Serialize)]
pub struct VapidPublicKeyResponse {
    pub public_key: String,
}

pub fn notification_routes(state: Arc<NotificationState>) -> Router {
    Router::new()
        .route("/notifications/vapid-public-key", get(get_vapid_key))
        .route("/notifications/subscribe", post(subscribe))
        .route("/notifications/unsubscribe", post(unsubscribe))
        .with_state(state)
}

async fn get_vapid_key(
    State(state): State<Arc<NotificationState>>,
) -> Json<VapidPublicKeyResponse> {
    Json(VapidPublicKeyResponse {
        public_key: state.vapid_public_key.clone(),
    })
}

async fn subscribe(
    State(state): State<Arc<NotificationState>>,
    Extension(auth_user): Extension<AuthUser>,
    Json(req): Json<SubscribeRequest>,
) -> Result<StatusCode, (StatusCode, String)> {
    let user_id = match uuid::Uuid::parse_str(&auth_user.user_id) {
        Ok(uid) => UserId::new(uid),
        Err(_) => return Err((StatusCode::BAD_REQUEST, "Invalid user ID".to_string())),
    };

    let repo = PushSubscriptionRepoImpl { db: state.db.clone() };
    repo.insert(
        user_id.0,
        req.endpoint,
        req.keys.p256dh,
        req.keys.auth,
        req.expiration_time,
    )
    .await
    .map_err(|e: anyhow::Error| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(StatusCode::OK)
}

async fn unsubscribe(
    State(state): State<Arc<NotificationState>>,
    Json(req): Json<UnsubscribeRequest>,
) -> Result<StatusCode, (StatusCode, String)> {
    let repo = PushSubscriptionRepoImpl { db: state.db.clone() };
    repo.delete_by_endpoint(req.endpoint)
        .await
        .map_err(|e: anyhow::Error| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(StatusCode::OK)
}

use axum::{
    Json, Router,
    extract::{Extension, State},
    http::StatusCode,
    routing::post,
};
use sb_auth::middleware::AuthUser;
use sea_orm::{DatabaseConnection, EntityTrait, Set, ActiveModelTrait, ColumnTrait, QueryFilter};
use sb_db_entities::user;
use serde_json::{json, Value};
use std::sync::Arc;
use uuid::Uuid;

#[derive(serde::Deserialize)]
pub struct SubscribeRequest {
    pub subscription: serde_json::Value,
}

pub async fn subscribe(
    Extension(auth_user): Extension<AuthUser>,
    State(db): State<Arc<DatabaseConnection>>,
    Json(req): Json<SubscribeRequest>,
) -> Result<Json<Value>, (StatusCode, String)> {
    let user_id = Uuid::parse_str(&auth_user.user_id)
        .map_err(|_| (StatusCode::BAD_REQUEST, "Invalid user ID".to_string()))?;

    // Find the user
    let user_model = user::Entity::find()
        .filter(user::Column::Id.eq(user_id))
        .one(db.as_ref())
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
        .ok_or_else(|| (StatusCode::NOT_FOUND, "User not found".to_string()))?;

    // Update the push_subscription field
    let mut active: user::ActiveModel = user_model.into();
    active.push_subscription = Set(Some(req.subscription));
    active.update(db.as_ref())
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(Json(json!({ "status": "subscribed" })))
}

pub fn notification_routes(db: Arc<DatabaseConnection>) -> Router {
    Router::new()
        .route("/notifications/subscribe", post(subscribe))
        .with_state(db)
}

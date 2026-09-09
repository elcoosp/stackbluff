use axum::{Json, Router, extract::Extension, http::StatusCode, routing::post};
use chrono::Utc;
use sb_shared_types::RequestContext;
use sea_orm::{ActiveModelTrait, Set};
use serde::Deserialize;
use std::sync::Arc;
use uuid::Uuid;

use crate::AppState;

#[derive(Deserialize)]
pub struct AnalyticsEvent {
    pub event_type: String,
    pub payload: serde_json::Value,
}

pub async fn ingest_event(
    Extension(state): Extension<Arc<AppState>>,
    Extension(ctx): Extension<RequestContext>,
    Json(event): Json<AnalyticsEvent>,
) -> Result<(), (StatusCode, String)> {
    let user_id = ctx
        .user_id
        .ok_or((StatusCode::UNAUTHORIZED, "Unauthorized".to_string()))?;

    let db = &state.db;

    let new_event = sb_db_entities::analytics_event::ActiveModel {
        id: Set(Uuid::new_v4()),
        user_id: Set(user_id.as_uuid()),
        event_type: Set(event.event_type),
        payload_json: Set(event.payload),
        created_at: Set(Utc::now()),
    };

    new_event
        .insert(db)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(())
}

pub fn analytics_routes() -> Router {
    Router::new().route("/api/analytics/event", post(ingest_event))
}

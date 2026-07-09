use axum::{
    Json, Router,
    extract::{Extension, Query, State},
    http::StatusCode,
    routing::get,
};
use base64::prelude::*;
use chrono::{DateTime, Utc};
use sb_auth::middleware::AuthUser;
use sb_shared_types::RequestContext;
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use uuid::Uuid;

#[derive(Deserialize)]
pub struct ListHandsQuery {
    pub limit: Option<u64>,
    pub cursor: Option<String>, // base64 encoded "played_at,id"
}

#[derive(Serialize)]
pub struct HandSummaryResponse {
    pub id: Uuid,
    pub table_id: Uuid,
    pub played_at: DateTime<Utc>,
    pub pot: i64,
    pub winners: Vec<WinnerSummary>,
    pub community_cards: Vec<String>,
    pub winner_hole_cards: Option<Vec<String>>,
}

#[derive(Serialize)]
pub struct WinnerSummary {
    pub user_id: Uuid,
    pub amount: i64,
    pub hand_rank: String,
}

pub fn hand_history_routes() -> Router<Arc<crate::AppState>> {
    Router::new().route("/hands", get(list_user_hands))
}

pub async fn list_user_hands(
    Extension(auth_user): Extension<AuthUser>,
    State(state): State<Arc<crate::AppState>>,
    Query(params): Query<ListHandsQuery>,
) -> Result<Json<serde_json::Value>, (StatusCode, String)> {
    let user_id = Uuid::parse_str(&auth_user.user_id)
        .map_err(|_| (StatusCode::BAD_REQUEST, "Invalid user ID".to_string()))?;

    let ctx = RequestContext::new(Uuid::new_v4(), Some(sb_shared_types::UserId(user_id)));

    let cursor = params.cursor.and_then(|c| {
        BASE64_STANDARD.decode(c.as_bytes()).ok().and_then(|bytes| {
            String::from_utf8(bytes).ok().and_then(|s| {
                let parts: Vec<&str> = s.split(',').collect();
                if parts.len() == 2 {
                    let played_at = DateTime::parse_from_rfc3339(parts[0])
                        .ok()
                        .map(|dt| dt.with_timezone(&Utc));
                    let id = Uuid::parse_str(parts[1]).ok();
                    played_at.zip(id)
                } else {
                    None
                }
            })
        })
    });

    let limit = params.limit.unwrap_or(20).min(100);

    let (summaries, next_cursor) = state
        .hand_history_repo
        .list_user_hands(ctx, user_id, limit, cursor)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let next_cursor_b64 = next_cursor.map(|(dt, id)| {
        let s = format!("{},{}", dt.to_rfc3339(), id);
        BASE64_STANDARD.encode(s.as_bytes())
    });

    Ok(Json(serde_json::json!({
        "histories": summaries,
        "total": summaries.len(),
        "next_cursor": next_cursor_b64,
    })))
}

use axum::{
    Router,
    extract::{Extension, State},
    http::StatusCode,
    response::Json,
    routing::get,
};
use std::sync::Arc;
use uuid::Uuid;

use sb_auth::middleware::AuthUser;
use sb_shared_types::RequestContext;
use serde::Serialize;

use crate::{AppState, ErrorResponse, internal_error, bad_request};

#[derive(Serialize)]
pub struct ReplayCardResponse {
    pub id: Uuid,
    pub hand_description: String,
    pub winner_name: String,
    pub winner_id: Uuid,
    pub pot: i64,
    pub played_at: chrono::DateTime<chrono::Utc>,
    pub table_id: Uuid,
    pub community_cards: Vec<String>,
    pub winner_cards: Option<Vec<String>>,
    pub share_url: String,
}

pub fn replay_routes() -> Router<Arc<AppState>> {
    Router::new().route("/replays", get(get_replays))
}

async fn get_replays(
    Extension(auth_user): Extension<AuthUser>,
    State(state): State<Arc<AppState>>,
) -> Result<Json<Vec<ReplayCardResponse>>, (StatusCode, Json<ErrorResponse>)> {
    let user_id = Uuid::parse_str(&auth_user.user_id)
        .map_err(|_| bad_request("INVALID_USER", "Invalid user ID"))?;

    let ctx = RequestContext::new(Uuid::new_v4(), Some(sb_shared_types::UserId(user_id)));

    let replays = state
        .hand_history_repo
        .list_user_replays(ctx, user_id)
        .await
        .map_err(|e| internal_error(e))?;

    // Convert to response type.
    let response: Vec<ReplayCardResponse> = replays
        .into_iter()
        .map(|r| ReplayCardResponse {
            id: r.id,
            hand_description: r.hand_description,
            winner_name: r.winner_name,
            winner_id: r.winner_id.0,
            pot: r.pot,
            played_at: r.played_at,
            table_id: r.table_id.0,
            community_cards: r.community_cards,
            winner_cards: r.winner_cards,
            share_url: r.share_url,
        })
        .collect();

    Ok(Json(response))
}

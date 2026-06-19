use std::sync::Arc;
use std::time::Duration;

use axum::{
    Json, Router,
    extract::{Path, State},
    http::StatusCode,
    routing::get,
};
use moka::sync::Cache;
use sb_contracts::repo_api::UserRepo;
use sb_contracts::stats_api::PlayerStatsRepo;
use sb_shared_types::player_stats::PlayerStatsDto;
use uuid::Uuid;

#[derive(Clone)]
pub struct StatsRouterState {
    pub stats_repo: Arc<dyn PlayerStatsRepo>,
    pub _user_repo: Arc<dyn UserRepo>, // kept for future use (e.g. resolving display_name)
    pub cache: Cache<String, PlayerStatsDto>,
}

pub fn player_stats_routes(
    stats_repo: Arc<dyn PlayerStatsRepo>,
    user_repo: Arc<dyn UserRepo>,
) -> Router {
    let cache = Cache::builder()
        .time_to_live(Duration::from_secs(30))
        .max_capacity(10_000)
        .build();

    let state = Arc::new(StatsRouterState {
        stats_repo,
        _user_repo: user_repo,
        cache,
    });

    Router::new()
        // FIX: Changed from :user_id to {user_id} for Axum 0.8
        .route("/players/{user_id}/stats", get(get_player_stats))
        .with_state(state)
}

pub async fn get_player_stats(
    Path(user_id): Path<String>,
    State(state): State<Arc<StatsRouterState>>,
) -> Result<Json<PlayerStatsDto>, (StatusCode, String)> {
    let _ = Uuid::parse_str(&user_id)
        .map_err(|_| (StatusCode::BAD_REQUEST, "Invalid UUID".to_string()))?;

    if let Some(cached) = state.cache.get(&user_id) {
        return Ok(Json(cached));
    }

    let stats = state
        .stats_repo
        .get(&user_id)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    state.cache.insert(user_id, stats.clone());

    Ok(Json(stats))
}

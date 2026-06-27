use axum::{
    Router,
    extract::{Path, State},
    http::StatusCode,
    response::Json,
    routing::get,
};
use sea_orm::DatabaseConnection;
use serde_json::json;
use std::sync::Arc;
use uuid::Uuid;

use sb_db_repos::season_card_repo::SeaOrmSeasonCardRepo;

pub fn router(db: DatabaseConnection) -> Router {
    let repo = Arc::new(SeaOrmSeasonCardRepo::new(db));
    Router::new()
        .route("/season-cards", get(list_season_cards))
        .route("/season-cards/{season_id}", get(get_season_card))
        .with_state(repo)
}

async fn list_season_cards(
    State(repo): State<Arc<SeaOrmSeasonCardRepo>>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    let user_id = Uuid::nil();
    match repo.find_by_user(user_id).await {
        Ok(cards) => Ok(Json(json!({ "cards": cards }))),
        Err(_) => Err(StatusCode::INTERNAL_SERVER_ERROR),
    }
}

async fn get_season_card(
    State(repo): State<Arc<SeaOrmSeasonCardRepo>>,
    Path(season_id): Path<i32>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    let user_id = Uuid::nil();
    match repo.find_by_user_and_season(user_id, season_id).await {
        Ok(Some(card)) => Ok(Json(json!({ "card": card }))),
        Ok(None) => Err(StatusCode::NOT_FOUND),
        Err(_) => Err(StatusCode::INTERNAL_SERVER_ERROR),
    }
}

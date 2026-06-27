use axum::{
    extract::{Path, State},
    Json,
};
use sb_db_entities::user_season_card;

#[derive(serde::Serialize)]
pub struct SeasonCardResponse {
    pub season_id: i32,
    pub card_image_url: Option<String>,
    pub card_data: Option<serde_json::Value>,
    pub generated_at: Option<String>,
}

pub async fn get_season_card(
    State(db): State<sea_orm::DatabaseConnection>,
    Path((user_id, season_id)): Path<(uuid::Uuid, i32)>,
) -> Result<Json<SeasonCardResponse>, axum::http::StatusCode> {
    let card: Option<user_season_card::Model> = user_season_card::Entity::find_by_id((user_id, season_id))
        .one(&db)
        .await
        .map_err(|_| axum::http::StatusCode::INTERNAL_SERVER_ERROR)?;

    let card = card.ok_or(axum::http::StatusCode::NOT_FOUND)?;

    Ok(Json(SeasonCardResponse {
        season_id: card.season_id,
        card_image_url: card.card_image_url,
        card_data: card.card_data.map(|j| serde_json::Value::from(j)),
        generated_at: Some(card.generated_at.to_string()),
    }))
}

use async_trait::async_trait;
use sea_orm::{ActiveModelTrait, DbErr, Set};
use sb_db_entities::user_season_card;
use uuid::Uuid;

#[async_trait]
pub trait SeasonCardRepo: Send + Sync {
    async fn store_card(
        &self,
        user_id: Uuid,
        season_id: i32,
        card_image_url: Option<String>,
        card_data: serde_json::Value,
    ) -> Result<(), DbErr>;
}

pub struct SeaOrmSeasonCardRepo {
    db: sea_orm::DatabaseConnection,
}

impl SeaOrmSeasonCardRepo {
    pub fn new(db: sea_orm::DatabaseConnection) -> Self {
        Self { db }
    }
}

#[async_trait]
impl SeasonCardRepo for SeaOrmSeasonCardRepo {
    async fn store_card(
        &self,
        user_id: Uuid,
        season_id: i32,
        card_image_url: Option<String>,
        card_data: serde_json::Value,
    ) -> Result<(), DbErr> {
        let active = user_season_card::ActiveModel {
            user_id: Set(user_id),
            season_id: Set(season_id),
            card_image_url: Set(card_image_url),
            card_data: Set(Some(card_data)),
            generated_at: Set(chrono::Utc::now().into()),
        };
        active.insert(&self.db).await?;
        Ok(())
    }
}

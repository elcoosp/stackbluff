use async_trait::async_trait;
use sea_orm::{ActiveModelTrait, ColumnTrait, DbErr, EntityTrait, QueryFilter, Set};
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

    async fn find_by_user_and_season(
        &self,
        user_id: Uuid,
        season_id: i32,
    ) -> Result<Option<user_season_card::Model>, DbErr>;

    async fn find_by_user(
        &self,
        user_id: Uuid,
    ) -> Result<Vec<user_season_card::Model>, DbErr>;
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

    async fn find_by_user_and_season(
        &self,
        user_id: Uuid,
        season_id: i32,
    ) -> Result<Option<user_season_card::Model>, DbErr> {
        user_season_card::Entity::find()
            .filter(user_season_card::Column::UserId.eq(user_id))
            .filter(user_season_card::Column::SeasonId.eq(season_id))
            .one(&self.db)
            .await
    }

    async fn find_by_user(
        &self,
        user_id: Uuid,
    ) -> Result<Vec<user_season_card::Model>, DbErr> {
        user_season_card::Entity::find()
            .filter(user_season_card::Column::UserId.eq(user_id))
            .all(&self.db)
            .await
    }
}

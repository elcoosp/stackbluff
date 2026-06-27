use image::{ImageBuffer, Rgba, RgbaImage};
use sb_contracts::notification_api::{NotificationEvent, NotificationService};
use sb_db_entities::{enums::RankTier, player_rank, season};
use sb_db_repos::season_card_repo::SeasonCardRepo;
use sb_shared_types::errors::AppError;
use sea_orm::{ActiveModelTrait, ColumnTrait, EntityTrait, QueryFilter, Set, TransactionTrait};
use std::sync::Arc;
use uuid::Uuid;

use crate::r2_storage::R2Storage;

pub struct SeasonCardGenerator {
    db: sea_orm::DatabaseConnection,
    r2: Arc<dyn R2Storage>,
    notifier: Arc<dyn NotificationService>,
    season_card_repo: Arc<dyn SeasonCardRepo>,
}

impl SeasonCardGenerator {
    pub fn new(
        db: sea_orm::DatabaseConnection,
        r2: Arc<dyn R2Storage>,
        notifier: Arc<dyn NotificationService>,
        season_card_repo: Arc<dyn SeasonCardRepo>,
    ) -> Self {
        Self {
            db,
            r2,
            notifier,
            season_card_repo,
        }
    }

    pub async fn run_scheduler(&self) {
        let mut interval = tokio::time::interval(tokio::time::Duration::from_secs(3600));
        loop {
            interval.tick().await;
            if let Err(e) = self.process_ended_seasons().await {
                tracing::error!("Season end processing failed: {}", e);
            }
        }
    }

    pub async fn process_ended_seasons(&self) -> Result<(), AppError> {
        let ended_seasons = season::Entity::find()
            .filter(season::Column::EndsAt.lt(chrono::Utc::now()))
            .filter(season::Column::Processed.eq(false))
            .all(&self.db)
            .await
            .map_err(|e| AppError::internal(format!("DB error: {e}")))?;

        for ended_season in ended_seasons {
            if let Err(e) = self.process_season(ended_season.id).await {
                tracing::error!("Failed to process season {}: {}", ended_season.id, e);
            }
        }

        Ok(())
    }

    pub async fn process_season(&self, season_id: i32) -> Result<(), AppError> {
        let txn = self
            .db
            .begin()
            .await
            .map_err(|e| AppError::internal(format!("Txn error: {e}")))?;

        let ranks = player_rank::Entity::find()
            .filter(player_rank::Column::SeasonId.eq(season_id))
            .all(&txn)
            .await
            .map_err(|e| AppError::internal(format!("DB error: {e}")))?;

        for rank in &ranks {
            match self
                .generate_and_store_card(rank.user_id, season_id, rank.tier)
                .await
            {
                Ok(url) => {
                    if let Err(e) = self
                        .notifier
                        .send(NotificationEvent::SeasonCardReady {
                            season_id,
                            card_url: Some(url),
                        })
                        .await
                    {
                        tracing::warn!("Notification failed for user {}: {}", rank.user_id, e);
                    }
                }
                Err(e) => {
                    tracing::error!("Card generation failed for user {}: {}", rank.user_id, e);
                }
            }
        }

        let next_season_id = season_id + 1;
        for rank in &ranks {
            let new_tier = rank.tier.reset_rank();
            let active = player_rank::ActiveModel {
                user_id: Set(rank.user_id),
                season_id: Set(next_season_id),
                tier: Set(new_tier),
                rank_points: Set(0),
                ..Default::default()
            };
            player_rank::Entity::insert(active)
                .exec(&txn)
                .await
                .map_err(|e| AppError::internal(format!("Insert error: {e}")))?;
        }

        let season_model = season::Entity::find_by_id(season_id)
            .one(&txn)
            .await
            .map_err(|e| AppError::internal(format!("DB error: {e}")))?
            .ok_or_else(|| AppError::internal("Season not found"))?;
        let mut season_active: season::ActiveModel = season_model.into();
        season_active.processed = Set(true);
        season_active
            .update(&txn)
            .await
            .map_err(|e| AppError::internal(format!("Update error: {e}")))?;

        txn.commit()
            .await
            .map_err(|e| AppError::internal(format!("Commit error: {e}")))?;

        tracing::info!("Season {} processed successfully", season_id);
        Ok(())
    }

    async fn generate_and_store_card(
        &self,
        user_id: Uuid,
        season_id: i32,
        tier: RankTier,
    ) -> Result<String, AppError> {
        let card_data = serde_json::json!({
            "season_id": season_id,
            "user_id": user_id,
            "rank_tier": format!("{:?}", tier),
            "generated_at": chrono::Utc::now().to_rfc3339(),
        });

        let img_bytes = generate_card_image(&tier)?;
        let key = format!("seasons/{}/user_{}.png", season_id, user_id);
        let url = self
            .r2
            .put_object("season-cards", &key, img_bytes, "image/png")
            .await?;

        self.season_card_repo
            .store_card(user_id, season_id, Some(url.clone()), card_data)
            .await
            .map_err(|e| AppError::internal(format!("Repo error: {e}")))?;

        Ok(url)
    }
}

fn generate_card_image(tier: &RankTier) -> Result<Vec<u8>, AppError> {
    let width = 800u32;
    let height = 600u32;
    let mut img: RgbaImage = ImageBuffer::new(width, height);

    let (r, g, b) = match tier {
        RankTier::Legend => (255, 215, 0),
        RankTier::Maestro => (220, 20, 60),
        RankTier::Diamond => (0, 191, 255),
        RankTier::Platinum => (229, 228, 226),
        RankTier::Gold => (255, 223, 0),
        RankTier::Silver => (192, 192, 192),
        RankTier::Bronze => (205, 127, 50),
        RankTier::Brick => (139, 69, 19),
    };

    for y in 0..height {
        for x in 0..width {
            img.put_pixel(x, y, Rgba([r, g, b, 255]));
        }
    }

    let mut bytes: Vec<u8> = Vec::new();
    img.write_to(
        &mut std::io::Cursor::new(&mut bytes),
        image::ImageFormat::Png,
    )
    .map_err(|e| AppError::internal(format!("Image encode error: {e}")))?;
    Ok(bytes)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_card_image_generation() {
        let bytes = generate_card_image(&RankTier::Diamond).unwrap();
        assert!(!bytes.is_empty());
    }
}

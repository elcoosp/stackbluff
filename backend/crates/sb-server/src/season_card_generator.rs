use image::{ImageBuffer, Rgba, RgbaImage};
use sb_db_entities::{enums::RankTier, player_rank, season};
use sb_db_repos::season_card_repo::SeasonCardRepo;
use sb_shared_types::errors::AppError;
use sea_orm::{
    ActiveModelTrait, ColumnTrait, EntityTrait, QueryFilter, QueryOrder, Set, TransactionTrait,
};
use std::sync::Arc;
use uuid::Uuid;

use sb_contracts::r2_storage::R2Storage;

pub struct SeasonCardGenerator {
    db: sea_orm::DatabaseConnection,
    r2: Arc<dyn R2Storage>,
    season_card_repo: Arc<dyn SeasonCardRepo>,
}

impl SeasonCardGenerator {
    pub fn new(
        db: sea_orm::DatabaseConnection,
        r2: Arc<dyn R2Storage>,
        season_card_repo: Arc<dyn SeasonCardRepo>,
    ) -> Self {
        Self {
            db,
            r2,
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
            .map_err(|e| AppError::Internal(format!("DB error: {e}")))?;

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
            .map_err(|e| AppError::Internal(format!("Txn error: {e}")))?;

        let ranks = player_rank::Entity::find()
            .filter(player_rank::Column::SeasonId.eq(season_id))
            .all(&txn)
            .await
            .map_err(|e| AppError::Internal(format!("DB error: {e}")))?;

        for rank in &ranks {
            match self
                .generate_and_store_card(rank.user_id, season_id, rank.rank_tier.clone())
                .await
            {
                Ok(url) => {
                    tracing::info!("Generated card for user {}: {}", rank.user_id, url);
                }
                Err(e) => {
                    tracing::error!("Card generation failed for user {}: {}", rank.user_id, e);
                }
            }
        }

        // Find the current season to get its starts_at
        let current_season = season::Entity::find_by_id(season_id)
            .one(&txn)
            .await
            .map_err(|e| AppError::Internal(format!("DB error: {e}")))?
            .ok_or_else(|| AppError::Internal("Season not found".to_string()))?;

        // Find the next season by starts_at > current season's starts_at
        let next_season = season::Entity::find()
            .filter(season::Column::StartsAt.gt(current_season.starts_at))
            .order_by_asc(season::Column::StartsAt)
            .one(&txn)
            .await
            .map_err(|e| AppError::Internal(format!("DB error: {e}")))?;

        let next_season_id = next_season.map(|s| s.id).unwrap_or(season_id + 1);

        for rank in &ranks {
            let new_tier = rank.rank_tier.reset_rank();
            let active = player_rank::ActiveModel {
                user_id: Set(rank.user_id),
                season_id: Set(next_season_id),
                rank_tier: Set(new_tier),
                rank_points: Set(0),
            };
            player_rank::Entity::insert(active)
                .exec(&txn)
                .await
                .map_err(|e| AppError::Internal(format!("Insert error: {e}")))?;
        }

        let season_model = season::Entity::find_by_id(season_id)
            .one(&txn)
            .await
            .map_err(|e| AppError::Internal(format!("DB error: {e}")))?
            .ok_or_else(|| AppError::Internal("Season not found".to_string()))?;
        let mut season_active: season::ActiveModel = season_model.into();
        season_active.processed = Set(true);
        season_active
            .update(&txn)
            .await
            .map_err(|e| AppError::Internal(format!("Update error: {e}")))?;

        txn.commit()
            .await
            .map_err(|e| AppError::Internal(format!("Commit error: {e}")))?;

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
            .map_err(|e| AppError::Internal(format!("Repo error: {e}")))?;

        Ok(url)
    }
}

/// Generate a polished card image with a gradient, border, and a central medal icon.
/// No text – the frontend can overlay text if needed.
fn generate_card_image(tier: &RankTier) -> Result<Vec<u8>, AppError> {
    let width = 800u32;
    let height = 600u32;
    let mut img: RgbaImage = ImageBuffer::new(width, height);

    // Define colors for each tier
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

    // Background gradient: from color to slightly darker
    for y in 0..height {
        let factor = y as f32 / height as f32;
        let r2 = (r as f32 * (1.0 - factor * 0.3)) as u8;
        let g2 = (g as f32 * (1.0 - factor * 0.3)) as u8;
        let b2 = (b as f32 * (1.0 - factor * 0.3)) as u8;
        for x in 0..width {
            img.put_pixel(x, y, Rgba([r2, g2, b2, 255]));
        }
    }

    // Draw a rounded rectangle border (simulate with a simple frame)
    let border_color = Rgba([255, 255, 255, 180]);
    let border_width = 12;
    for x in 0..width {
        for y in 0..height {
            if x < border_width
                || x >= width - border_width
                || y < border_width
                || y >= height - border_width
            {
                img.put_pixel(x, y, border_color);
            }
        }
    }

    // Draw a central medal circle
    let center_x = width / 2;
    let center_y = height / 2;
    let radius: i32 = 120; // use i32 to avoid type mismatches
    let medal_color = Rgba([255, 255, 255, 220]);
    for x in (center_x - radius as u32)..(center_x + radius as u32) {
        for y in (center_y - radius as u32)..(center_y + radius as u32) {
            let dx = x as i32 - center_x as i32;
            let dy = y as i32 - center_y as i32;
            if dx * dx + dy * dy <= radius * radius {
                img.put_pixel(x, y, medal_color);
            }
        }
    }

    // Draw a smaller inner circle with the rank color
    let inner_radius: i32 = 90;
    let (r3, g3, b3) = match tier {
        RankTier::Legend => (255, 215, 0),
        RankTier::Maestro => (220, 20, 60),
        RankTier::Diamond => (0, 191, 255),
        RankTier::Platinum => (200, 200, 200),
        RankTier::Gold => (255, 215, 0),
        RankTier::Silver => (180, 180, 180),
        RankTier::Bronze => (205, 127, 50),
        RankTier::Brick => (139, 69, 19),
    };
    let inner_color = Rgba([r3, g3, b3, 255]);
    for x in (center_x - inner_radius as u32)..(center_x + inner_radius as u32) {
        for y in (center_y - inner_radius as u32)..(center_y + inner_radius as u32) {
            let dx = x as i32 - center_x as i32;
            let dy = y as i32 - center_y as i32;
            if dx * dx + dy * dy <= inner_radius * inner_radius {
                img.put_pixel(x, y, inner_color);
            }
        }
    }

    // Add a small star or diamond shape in the center
    let star_color = Rgba([255, 255, 255, 255]);
    for x in (center_x - 20)..(center_x + 20) {
        for y in (center_y - 20)..(center_y + 20) {
            let dx = (x as i32 - center_x as i32).abs();
            let dy = (y as i32 - center_y as i32).abs();
            if dx + dy < 20 {
                img.put_pixel(x, y, star_color);
            }
        }
    }

    // Encode as PNG
    let mut bytes: Vec<u8> = Vec::new();
    img.write_to(
        &mut std::io::Cursor::new(&mut bytes),
        image::ImageFormat::Png,
    )
    .map_err(|e| AppError::Internal(format!("Image encode error: {e}")))?;
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

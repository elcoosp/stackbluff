use chrono::Utc;
use sea_orm::{
    ColumnTrait, DatabaseConnection, EntityTrait, QueryFilter, Set,
};
use std::sync::Arc;

use sb_db_entities::enums::RankTier;
use sb_db_entities::player_rank;
use sb_db_entities::season;
use sb_db_entities::user_season_card;
use sb_db_entities::user_statistics;

use crate::hand_archive::R2Storage;

/// Process all seasons that have ended but not been processed yet.
pub async fn process_ended_seasons(
    db: &DatabaseConnection,
    _r2: Arc<dyn R2Storage>,
) -> Result<(), Box<dyn std::error::Error>> {
    let ended_seasons = season::Entity::find()
        .filter(season::Column::EndsAt.lt(Utc::now()))
        .filter(season::Column::Processed.eq(false))
        .all(db)
        .await?;

    for ended_season in ended_seasons {
        let season_id = ended_season.id;

        let player_ranks = player_rank::Entity::find()
            .filter(player_rank::Column::SeasonId.eq(season_id))
            .all(db)
            .await?;

        let next_season = season::Entity::find()
            .filter(season::Column::StartsAt.gt(ended_season.ends_at))
            .order_by_asc(season::Column::StartsAt)
            .one(db)
            .await?;

        for pr in player_ranks {
            let user_id = pr.user_id;
            let final_tier = pr.rank_tier;

            let stats = user_statistics::Entity::find_by_id(user_id.to_string())
                .one(db)
                .await?
                .unwrap_or_else(|| user_statistics::Model {
                    user_id: user_id.to_string(),
                    hands_played: 0,
                    hands_won: 0,
                    vpip_hands: 0,
                    pfr_hands: 0,
                    preflop_fold_count: 0,
                    showdowns: 0,
                    showdown_wins: 0,
                    hands_won_without_showdown: 0,
                    total_wagered: 0,
                    total_won: 0,
                    net_profit: 0,
                    biggest_pot_won: 0,
                    all_in_count: 0,
                    bets: 0,
                    raises: 0,
                    calls: 0,
                    last_hand_played_at: None,
                    last_hand_id: None,
                    last_updated_at: Utc::now().to_rfc3339(),
                    version: 0,
                });

            let card_data = serde_json::json!({
                "rank_tier": final_tier,
                "hands_played": stats.hands_played,
                "total_chips_won": stats.total_won,
                "best_hand": "Royal Flush",
            });

            let card_active = user_season_card::ActiveModel {
                user_id: Set(user_id),
                season_id: Set(season_id),
                card_image_url: Set(None),
                card_data: Set(Some(card_data)),
                generated_at: Set(Utc::now()),
                ..Default::default()
            };

            user_season_card::Entity::insert(card_active)
                .exec(db)
                .await?;

            if let Some(ref next) = next_season {
                let new_tier = final_tier.reset_rank();
                let new_rank = player_rank::ActiveModel {
                    user_id: Set(user_id),
                    season_id: Set(next.id),
                    rank_tier: Set(new_tier),
                    rank_points: Set(0),
                    ..Default::default()
                };
                player_rank::Entity::insert(new_rank)
                    .exec(db)
                    .await?;
            }
        }

        let mut season_active: season::ActiveModel = ended_season.into();
        season_active.processed = Set(true);
        season::Entity::update(season_active)
            .exec(db)
            .await?;
    }

    Ok(())
}

/// Spawn a background task that checks for season end every hour.
pub async fn spawn_season_end_task(
    db: DatabaseConnection,
    r2: Arc<dyn R2Storage>,
) {
    tokio::spawn(async move {
        let mut interval = tokio::time::interval(tokio::time::Duration::from_secs(3600));
        loop {
            interval.tick().await;
            if let Err(e) = process_ended_seasons(&db, r2.clone()).await {
                tracing::error!("season end processing failed: {}", e);
            }
        }
    });
}

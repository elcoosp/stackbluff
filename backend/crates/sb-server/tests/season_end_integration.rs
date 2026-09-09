//! Integration test for season end processing.
//! Uses an in-memory SQLite database with migrations.

use chrono::{Duration, Utc};
use sb_contracts::r2_storage::R2Storage;
use sb_db_entities::{enums::Platform, enums::RankTier, player_rank, season, user};
use sb_server::season_card_generator::SeasonCardGenerator;
use sea_orm::{ActiveModelTrait, ColumnTrait, Database, EntityTrait, QueryFilter, Set};
use sea_orm_migration::MigratorTrait;
use std::sync::Arc;
use uuid::Uuid;

// Dummy R2 storage for tests
struct DummyR2;
#[async_trait::async_trait]
impl R2Storage for DummyR2 {
    async fn put_object(
        &self,
        _bucket: &str,
        _key: &str,
        _data: Vec<u8>,
        _content_type: &str,
    ) -> Result<String, sb_shared_types::AppError> {
        Ok("https://dummy.url/card.png".to_string())
    }
}

// Mock SeasonCardRepo that just records calls
struct MockSeasonCardRepo;
#[async_trait::async_trait]
impl sb_db_repos::season_card_repo::SeasonCardRepo for MockSeasonCardRepo {
    async fn store_card(
        &self,
        _user_id: Uuid,
        _season_id: i32,
        _card_image_url: Option<String>,
        _card_data: serde_json::Value,
    ) -> Result<(), sea_orm::DbErr> {
        // Do nothing, just return Ok
        Ok(())
    }
    async fn find_by_user_and_season(
        &self,
        _user_id: Uuid,
        _season_id: i32,
    ) -> Result<Option<sb_db_entities::user_season_card::Model>, sea_orm::DbErr> {
        unimplemented!()
    }
    async fn find_by_user(
        &self,
        _user_id: Uuid,
    ) -> Result<Vec<sb_db_entities::user_season_card::Model>, sea_orm::DbErr> {
        unimplemented!()
    }
}

#[tokio::test]
async fn test_season_end_creates_cards_and_resets_ranks() {
    // Setup in-memory database and run migrations
    let db = Database::connect("sqlite::memory:").await.unwrap();
    migration::Migrator::up(&db, None).await.unwrap();

    // Insert users first to satisfy foreign keys
    let user1 = Uuid::new_v4();
    let user2 = Uuid::new_v4();
    let now = Utc::now();
    for uid in [user1, user2] {
        let user_active = user::ActiveModel {
            id: Set(uid),
            display_name: Set(format!("User_{}", uid)),
            created_at: Set(now),
            updated_at: Set(now),
            platform: Set(Platform::Pwa),
            chip_balance: Set(0),
            streak_count: Set(0),
            ..Default::default()
        };
        user_active.insert(&db).await.unwrap();
    }

    // Create season 1 (ended)
    let season_id_1 = 1;
    let past = now - Duration::days(1);
    let season1_active = season::ActiveModel {
        id: Set(season_id_1),
        name: Set("Season 1".to_string()),
        starts_at: Set(past),
        ends_at: Set(past),
        processed: Set(false),
    };
    season1_active.insert(&db).await.unwrap();

    // Create season 2 (the next season, not yet processed)
    let season_id_2 = 2;
    let future = now + Duration::days(1);
    let season2_active = season::ActiveModel {
        id: Set(season_id_2),
        name: Set("Season 2".to_string()),
        starts_at: Set(now + Duration::hours(1)),
        ends_at: Set(future),
        processed: Set(false),
    };
    season2_active.insert(&db).await.unwrap();

    // Insert some player ranks for season 1
    let ranks = vec![
        (user1, RankTier::Gold, 1200),
        (user2, RankTier::Silver, 900),
    ];
    for (uid, tier, points) in ranks {
        let rank_active = player_rank::ActiveModel {
            user_id: Set(uid),
            season_id: Set(season_id_1),
            rank_tier: Set(tier),
            rank_points: Set(points),
        };
        rank_active.insert(&db).await.unwrap();
    }

    // Create the generator with dummy R2 and a mock season_card_repo
    let r2 = Arc::new(DummyR2);
    let season_card_repo = Arc::new(MockSeasonCardRepo);
    let generator = SeasonCardGenerator::new(db.clone(), r2, season_card_repo);

    // Process the season
    generator.process_season(season_id_1).await.unwrap();

    // Verify: next season ranks exist (season_id + 1 = 2)
    let next_ranks = player_rank::Entity::find()
        .filter(player_rank::Column::SeasonId.eq(season_id_2))
        .all(&db)
        .await
        .unwrap();
    assert_eq!(next_ranks.len(), 2, "Should create ranks for next season");

    // Check reset tiers: Gold -> Silver, Silver -> Silver
    let gold_rank = next_ranks.iter().find(|r| r.user_id == user1).unwrap();
    assert_eq!(gold_rank.rank_tier, RankTier::Silver);
    let silver_rank = next_ranks.iter().find(|r| r.user_id == user2).unwrap();
    assert_eq!(silver_rank.rank_tier, RankTier::Silver);

    // Verify season 1 is marked processed
    let season_model = season::Entity::find_by_id(season_id_1)
        .one(&db)
        .await
        .unwrap()
        .unwrap();
    assert!(season_model.processed);

    // Verify season 2 is still unprocessed
    let season2_model = season::Entity::find_by_id(season_id_2)
        .one(&db)
        .await
        .unwrap()
        .unwrap();
    assert!(!season2_model.processed);
}

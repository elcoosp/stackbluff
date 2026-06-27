use sea_orm_migration::prelude::*;
use sea_orm_migration::sea_orm::{ActiveModelTrait, EntityTrait, PaginatorTrait, Set};
use uuid::Uuid;

#[derive(DeriveMigrationName)]
pub struct Migration;

#[async_trait::async_trait]
impl MigrationTrait for Migration {
    async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        let db = manager.get_connection();

        use sb_db_entities::tournament;
        let count = tournament::Entity::find().count(db).await?;
        if count > 0 {
            println!("Tournaments already exist, skipping seed.");
            return Ok(());
        }

        let tournaments = vec![
            (
                "Micro Sit & Go",
                serde_json::json!({
                    "tournament_type": "SitAndGo",
                    "max_players": 6,
                    "buy_in": 100,
                    "blind_schedule": {
                        "levels": [
                            {"level": 1, "small_blind": 10, "big_blind": 20, "ante": 0, "duration_seconds": 300},
                            {"level": 2, "small_blind": 20, "big_blind": 40, "ante": 0, "duration_seconds": 300},
                            {"level": 3, "small_blind": 40, "big_blind": 80, "ante": 0, "duration_seconds": 300}
                        ]
                    },
                    "payout_structure": {
                        "entries": [
                            {"position": 1, "percentage": 65.0},
                            {"position": 2, "percentage": 35.0}
                        ]
                    },
                    "start_delay_seconds": 10,
                    "min_players_to_start": 3
                }),
            ),
            (
                "Standard Sit & Go",
                serde_json::json!({
                    "tournament_type": "SitAndGo",
                    "max_players": 9,
                    "buy_in": 250,
                    "blind_schedule": {
                        "levels": [
                            {"level": 1, "small_blind": 15, "big_blind": 30, "ante": 0, "duration_seconds": 300},
                            {"level": 2, "small_blind": 30, "big_blind": 60, "ante": 0, "duration_seconds": 300},
                            {"level": 3, "small_blind": 60, "big_blind": 120, "ante": 0, "duration_seconds": 300},
                            {"level": 4, "small_blind": 120, "big_blind": 240, "ante": 0, "duration_seconds": 300}
                        ]
                    },
                    "payout_structure": {
                        "entries": [
                            {"position": 1, "percentage": 50.0},
                            {"position": 2, "percentage": 30.0},
                            {"position": 3, "percentage": 20.0}
                        ]
                    },
                    "start_delay_seconds": 15,
                    "min_players_to_start": 4
                }),
            ),
            (
                "Weekend MTT",
                serde_json::json!({
                    "tournament_type": "Mtt",
                    "max_players": 20,
                    "buy_in": 500,
                    "blind_schedule": {
                        "levels": [
                            {"level": 1, "small_blind": 25, "big_blind": 50, "ante": 0, "duration_seconds": 600},
                            {"level": 2, "small_blind": 50, "big_blind": 100, "ante": 0, "duration_seconds": 600},
                            {"level": 3, "small_blind": 100, "big_blind": 200, "ante": 0, "duration_seconds": 600},
                            {"level": 4, "small_blind": 200, "big_blind": 400, "ante": 0, "duration_seconds": 600},
                            {"level": 5, "small_blind": 400, "big_blind": 800, "ante": 0, "duration_seconds": 600}
                        ]
                    },
                    "payout_structure": {
                        "entries": [
                            {"position": 1, "percentage": 40.0},
                            {"position": 2, "percentage": 25.0},
                            {"position": 3, "percentage": 15.0},
                            {"position": 4, "percentage": 10.0},
                            {"position": 5, "percentage": 5.0},
                            {"position": 6, "percentage": 5.0}
                        ]
                    },
                    "start_delay_seconds": 30,
                    "min_players_to_start": 6
                }),
            ),
        ];

        for (name, config_json) in tournaments {
            let id = Uuid::new_v4();
            let now = chrono::Utc::now();
            let active = sb_db_entities::tournament::ActiveModel {
                id: Set(id),
                name: Set(name.to_string()),
                config_json: Set(config_json),
                status: Set("Registering".to_string()),
                prize_pool: Set(0),
                started_at: Set(None),
                completed_at: Set(None),
                scheduled_start: sea_orm::Set(None),
                    created_at: Set(now),
            };
            active.insert(db).await?;
            println!("Seeded tournament: {}", name);
        }

        Ok(())
    }

    async fn down(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        let db = manager.get_connection();
        use sb_db_entities::tournament;
        tournament::Entity::delete_many().exec(db).await?;
        Ok(())
    }
}

use chrono::Utc;
use sb_db_entities::{
    enums::{TableStatus},
    table, user,
};
use sea_orm::{ActiveModelTrait, ColumnTrait, EntityTrait, PaginatorTrait, QueryFilter, Set};
use sea_orm_migration::prelude::*;
use uuid::Uuid;

#[derive(DeriveMigrationName)]
pub struct Migration;

#[async_trait::async_trait]
impl MigrationTrait for Migration {
    async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        let db = manager.get_connection();

        // Check if any tables already exist using Entity::find().count()
        let table_count = table::Entity::find().count(db).await?;
        if table_count > 0 {
            println!("Tables already exist, skipping seeding.");
            return Ok(());
        }

        // Ensure there is a system user
        let system_user_id = Uuid::parse_str("00000000-0000-0000-0000-000000000001").unwrap();
        let sys_user = user::Entity::find_by_id(system_user_id).one(db).await?;
        if sys_user.is_none() {
            let now = Utc::now();
            let new_user = user::ActiveModel {
                id: Set(system_user_id),
                display_name: Set("System".to_string()),
                created_at: Set(now),
                updated_at: Set(now),
                platform: Set("pwa".to_string()),
                ..Default::default()
            };
            new_user.insert(db).await?;
        }

        // Define base tables
        let base_tables = vec![
            ("The Obsidian Room", "Micro", 6, TableStatus::Waiting),
            ("Titanium Lounge", "Low", 9, TableStatus::Waiting),
            ("Machined Limits", "Medium", 9, TableStatus::Waiting),
            ("Emerald Table", "High", 6, TableStatus::Waiting),
            ("Diamond Reserve", "VeryHigh", 9, TableStatus::Waiting),
        ];

        for (name, stake_level, max_players, status) in base_tables {
            let config = sb_db_entities::table::TableConfig {
                stake_level: stake_level.to_string(),
                min_players: 2,
                max_players,
                is_tournament: false,
                tournament_config: None,
                turn_time_limit_ms: 30000, // <-- ADDED
            };
            let now = Utc::now();
            let table_id = Uuid::new_v4();
            let active = table::ActiveModel {
                name: Set(name.to_string()),
                id: Set(table_id),
                created_by: Set(system_user_id),
                config_json: Set(config),
                status: Set(status),
                club_id: Set(None),
                created_at: Set(now),
                ..Default::default() // <-- ADDED to prevent compilation errors
            };
            active.insert(db).await?;
            println!("Inserted table: {}", name);
        }

        Ok(())
    }

    async fn down(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        let db = manager.get_connection();
        let system_user_id = Uuid::parse_str("00000000-0000-0000-0000-000000000001").unwrap();
        table::Entity::delete_many()
            .filter(table::Column::CreatedBy.eq(system_user_id))
            .exec(db)
            .await?;
        user::Entity::delete_by_id(system_user_id).exec(db).await?;
        Ok(())
    }
}

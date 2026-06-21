use sb_contracts::lobby_api::{TableInfo, TableRepo};
use sb_db_entities::table;
use sb_db_entities::table::TableConfig as DbTableConfig;
use sb_shared_types::{AppError, StakeLevel, TableId};
use sea_orm::{ActiveModelTrait, DatabaseConnection, EntityTrait, QueryOrder, Set};
use uuid::Uuid;

pub struct TableRepoImpl {
    db: DatabaseConnection,
}

impl TableRepoImpl {
    pub fn new(db: DatabaseConnection) -> Self {
        Self { db }
    }
}

#[async_trait::async_trait]
impl TableRepo for TableRepoImpl {
    async fn list_tables(&self) -> Result<Vec<TableInfo>, AppError> {
        let models = table::Entity::find()
            .order_by_desc(table::Column::CreatedAt)
            .all(&self.db)
            .await
            .map_err(|e| AppError::Database(e.to_string()))?;

        let tables = models
            .into_iter()
            .map(|m| {
                let stake_level = match m.config_json.stake_level.as_str() {
                    "Micro" => StakeLevel::Micro,
                    "Low" => StakeLevel::Low,
                    "Medium" => StakeLevel::Medium,
                    "High" => StakeLevel::High,
                    "VeryHigh" => StakeLevel::VeryHigh,
                    _ => StakeLevel::Micro,
                };
                TableInfo {
                    table_id: TableId::new(m.id),
                    name: m.name.clone(),
                    stake_level,
                    current_players: 0,
                    max_players: m.config_json.max_players as u32,
                    status: format!("{:?}", m.status).to_lowercase(),
                }
            })
            .collect();

        Ok(tables)
    }

    async fn create_table(
        &self,
        name: Option<String>,
        stake_level: StakeLevel,
        max_players: u32,
    ) -> Result<TableId, AppError> {
        let id = Uuid::new_v4();
        let db_config = DbTableConfig {
            stake_level: format!("{:?}", stake_level),
            min_players: 2,
            max_players: max_players as u8,
            is_tournament: false,
            tournament_config: None,
            turn_time_limit_ms: 30_000, // <-- ADDED
        };
        let now = chrono::Utc::now();
        let table_name = name.unwrap_or_else(|| {
            format!(
                "Table {}",
                id.to_string().chars().take(8).collect::<String>()
            )
        });
        let active = table::ActiveModel {
            id: Set(id),
            name: Set(table_name),
            created_by: Set(Uuid::nil()),
            config_json: Set(db_config),
            status: Set(sb_db_entities::enums::TableStatus::Waiting),
            club_id: Set(None),
            created_at: Set(now),
            ..Default::default() // <-- ADDED to prevent future compilation errors
        };
        active
            .insert(&self.db)
            .await
            .map_err(|e| AppError::Database(e.to_string()))?;
        Ok(TableId::new(id))
    }
}

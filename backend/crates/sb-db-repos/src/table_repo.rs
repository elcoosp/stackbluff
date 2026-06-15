use sb_contracts::lobby_api::{TableInfo, TableRepo};
use sb_shared_types::{AppError, StakeLevel, TableId, ChipAmount, GameVariant};
use sb_shared_types::TableConfig as SharedTableConfig;
use sea_orm::{DatabaseConnection, EntityTrait, QueryOrder, ActiveModelTrait, Set};
use sb_db_entities::table;
use sb_db_entities::table::TableConfig as DbTableConfig;
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
        };
        let now = chrono::Utc::now();
        let active = table::ActiveModel {
            id: Set(id),
            created_by: Set(Uuid::nil()), // TODO: get from auth
            config_json: Set(db_config),
            status: Set(sb_db_entities::enums::TableStatus::Waiting),
            club_id: Set(None),
            created_at: Set(now),
        };
        active.insert(&self.db).await.map_err(|e| AppError::Database(e.to_string()))?;
        Ok(TableId::new(id))
    }
}

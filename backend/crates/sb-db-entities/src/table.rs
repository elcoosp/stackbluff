use crate::enums::TableStatus;
use sea_orm::entity::prelude::*;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, FromJsonQueryResult)]
pub struct TableConfig {
    pub stake_level: String,
    pub min_players: u8,
    pub max_players: u8,
    pub is_tournament: bool,
    pub tournament_config: Option<TournamentConfig>,
    #[serde(default = "default_turn_time_ms")]
    pub turn_time_limit_ms: u64, // <-- ADDED
}

fn default_turn_time_ms() -> u64 {
    30000
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct TournamentConfig {
    pub start_time: DateTimeUtc,
    pub blind_schedule: Vec<BlindLevel>,
    pub prize_pool: i64,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct BlindLevel {
    pub level: u32,
    pub small_blind: i64,
    pub big_blind: i64,
    pub duration_minutes: u32,
}

#[sea_orm::model]
#[derive(Clone, Debug, PartialEq, Eq, DeriveEntityModel, Serialize, Deserialize)]
#[sea_orm(table_name = "tables")]
pub struct Model {
    #[sea_orm(primary_key, auto_increment = false)]
    pub id: Uuid,
    pub name: String,
    pub created_by: Uuid,
    #[sea_orm(column_type = "Json")]
    pub config_json: TableConfig,
    pub status: TableStatus,
    pub club_id: Option<Uuid>,
    pub created_at: DateTimeUtc,
}

impl ActiveModelBehavior for ActiveModel {}

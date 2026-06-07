use super::TableStatus;
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
    pub created_by: Uuid,
    #[sea_orm(column_type = "Json")]
    pub config_json: TableConfig,
    pub status: TableStatus,
    pub club_id: Option<Uuid>,
    pub created_at: DateTimeUtc,
}

impl ActiveModelBehavior for ActiveModel {}

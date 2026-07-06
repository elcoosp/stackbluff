use sea_orm::entity::prelude::*;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[sea_orm::model]
#[derive(Clone, Debug, PartialEq, DeriveEntityModel, Serialize, Deserialize)]
#[sea_orm(table_name = "tournaments")]
pub struct Model {
    #[sea_orm(primary_key, auto_increment = false)]
    pub id: Uuid,
    pub name: String, // NEW
    #[sea_orm(column_type = "Json")]
    pub config_json: serde_json::Value,
    pub status: String,
    pub prize_pool: i64,
    pub started_at: Option<DateTimeUtc>,
    pub completed_at: Option<DateTimeUtc>,
    pub created_at: DateTimeUtc,
    pub scheduled_start: Option<DateTimeUtc>,
}

impl ActiveModelBehavior for ActiveModel {}

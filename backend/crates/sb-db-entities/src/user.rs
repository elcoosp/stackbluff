use sea_orm::entity::prelude::*;
use serde::{Serialize, Deserialize};
use uuid::Uuid;
use super::Platform;

#[sea_orm::model]
#[derive(Clone, Debug, PartialEq, Eq, DeriveEntityModel, Serialize, Deserialize)]
#[sea_orm(table_name = "users")]
pub struct Model {
    #[sea_orm(primary_key, auto_increment = false)]
    pub id: Uuid,
    pub telegram_id: Option<i64>,
    #[sea_orm(unique)]
    pub email: Option<String>,
    pub display_name: String,
    #[sea_orm(column_type = "BigInteger")]
    pub chip_balance: i64,
    pub streak_count: i32,
    pub created_at: DateTimeUtc,
    pub updated_at: DateTimeUtc,
    pub platform: Platform,
    pub email_verified_at: Option<DateTimeUtc>,
}

impl ActiveModelBehavior for ActiveModel {}

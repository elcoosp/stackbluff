use crate::enums::Platform;
use sea_orm::entity::prelude::*;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Clone, Debug, PartialEq, Eq, DeriveEntityModel, Serialize, Deserialize)]
#[sea_orm(table_name = "users")]
pub struct Model {
    #[sea_orm(primary_key, auto_increment = false)]
    pub id: Uuid,
    pub telegram_id: Option<i64>,
    #[sea_orm(unique)]
    pub email: String,
    pub display_name: String,
    #[sea_orm(column_type = "BigInteger")]
    pub chip_balance: i64,
    pub streak_count: i32,
    pub created_at: DateTimeUtc,
    pub updated_at: DateTimeUtc,
    pub platform: Platform,
    pub email_verified_at: Option<DateTimeUtc>,
    pub password_hash: Option<String>,
    pub password_changed_at: Option<DateTimeUtc>,
    pub registration_order: Option<i64>,
}

#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
pub enum Relation {}

impl ActiveModelBehavior for ActiveModel {}

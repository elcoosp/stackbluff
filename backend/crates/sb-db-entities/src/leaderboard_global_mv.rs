use sea_orm::entity::prelude::*;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[sea_orm::model]
#[derive(Clone, Debug, PartialEq, Eq, DeriveEntityModel, Serialize, Deserialize)]
#[sea_orm(table_name = "leaderboard_global_mv")]
pub struct Model {
    #[sea_orm(primary_key)]
    pub user_id: Uuid,
    pub display_name: String,
    #[sea_orm(column_type = "BigInteger")]
    pub total_chips_won: i64,
    pub rank_position: i32,
    pub refreshed_at: DateTimeUtc,
}

impl ActiveModelBehavior for ActiveModel {}

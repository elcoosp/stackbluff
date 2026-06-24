use sea_orm::entity::prelude::*;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[sea_orm::model]
#[derive(Clone, Debug, PartialEq, DeriveEntityModel, Serialize, Deserialize)]
#[sea_orm(table_name = "tournament_results")]
pub struct Model {
    #[sea_orm(primary_key, auto_increment = false)]
    pub id: Uuid,
    pub tournament_id: Uuid,
    pub user_id: Uuid,
    pub position: i32,
    pub prize: i64,
    pub completed_at: DateTimeUtc,
}

impl ActiveModelBehavior for ActiveModel {}

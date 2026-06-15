use crate::hand_history_json::{HandActions, HandPlayers, HandResult};
use sea_orm::entity::prelude::*;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[sea_orm::model]
#[derive(Clone, Debug, PartialEq, DeriveEntityModel, Serialize, Deserialize)]
#[sea_orm(table_name = "hand_history")]
pub struct Model {
    #[sea_orm(primary_key, auto_increment = false)]
    pub id: Uuid,
    pub table_id: Uuid,
    pub played_at: DateTimeUtc,
    #[sea_orm(column_type = "Json")]
    pub players_json: HandPlayers,
    #[sea_orm(column_type = "Json")]
    pub actions_json: HandActions,
    #[sea_orm(column_type = "Json")]
    pub result_json: HandResult,
    pub is_archived: bool,
}

impl ActiveModelBehavior for ActiveModel {}

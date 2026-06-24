use sea_orm::entity::prelude::*;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[sea_orm::model]
#[derive(Clone, Debug, PartialEq, DeriveEntityModel, Serialize, Deserialize)]
#[sea_orm(table_name = "tournament_registrations")]
pub struct Model {
    #[sea_orm(primary_key, auto_increment = false)]
    pub id: Uuid,
    pub tournament_id: Uuid,
    pub user_id: Uuid,
    pub buy_in: i64,
    pub registered_at: DateTimeUtc,
}

impl ActiveModelBehavior for ActiveModel {}

use sea_orm::entity::prelude::*;
use serde::{Serialize, Deserialize};

#[sea_orm::model]
#[derive(Clone, Debug, PartialEq, Eq, DeriveEntityModel, Serialize, Deserialize)]
#[sea_orm(table_name = "seasons")]
pub struct Model {
    #[sea_orm(primary_key)]
    pub id: i32,
    pub name: String,
    pub starts_at: DateTimeUtc,
    pub ends_at: DateTimeUtc,
}

impl ActiveModelBehavior for ActiveModel {}

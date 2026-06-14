use sea_orm::entity::prelude::*;

#[derive(Clone, Debug, PartialEq, DeriveEntityModel)]
#[sea_orm(table_name = "anti_cheat_events")]
pub struct Model {
    #[sea_orm(primary_key)]
    pub id: i64,
    pub user_ids: String,
    pub ip: Option<String>,
    pub event_type: String,
    pub details: Option<String>,
    pub created_at: DateTimeUtc,
}

#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
pub enum Relation {}

impl ActiveModelBehavior for ActiveModel {}

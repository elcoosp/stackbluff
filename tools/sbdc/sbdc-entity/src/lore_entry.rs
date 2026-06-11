use sea_orm::entity::prelude::*;

#[derive(Clone, Debug, PartialEq, Eq, DeriveEntityModel)]
#[sea_orm(table_name = "lore_entries")]
pub struct Model {
    #[sea_orm(primary_key, auto_increment = false)]
    pub lore_id: String,
    pub parent_entity: String,
    pub parent_id: String,
    pub category: String,
    pub title: String,
    pub content: String,
    pub source: String,
    pub status: String,
    pub injectable: bool,
    pub injection_weight: i32,
}

#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
pub enum Relation {}

impl ActiveModelBehavior for ActiveModel {}

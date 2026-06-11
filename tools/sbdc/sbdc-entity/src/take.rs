use sea_orm::entity::prelude::*;

#[derive(Clone, Debug, PartialEq, DeriveEntityModel)]
#[sea_orm(table_name = "take")]
pub struct Model {
    #[sea_orm(primary_key)]
    pub id: i32,
    pub prompt_id: i32,
    pub deck_id: String,
    pub take_number: i32,
    pub file_path: String,
    pub selected: bool,
    pub created_at: String,
}

#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
pub enum Relation {}

impl ActiveModelBehavior for ActiveModel {}

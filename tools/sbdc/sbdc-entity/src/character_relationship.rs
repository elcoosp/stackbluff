use sea_orm::entity::prelude::*;

#[derive(Clone, Debug, PartialEq, Eq, DeriveEntityModel)]
#[sea_orm(table_name = "character_relationships")]
pub struct Model {
    #[sea_orm(primary_key, auto_increment = false)]
    pub relationship_id: String,
    pub character_id_a: String,
    pub character_id_b: String,
    pub relationship_type: String,
    pub description: String,
    pub deck_id: Option<String>,
}

#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
pub enum Relation {}

impl ActiveModelBehavior for ActiveModel {}

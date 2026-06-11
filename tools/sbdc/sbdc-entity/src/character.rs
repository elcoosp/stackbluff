use sea_orm::entity::prelude::*;

#[sea_orm::model]
#[derive(Clone, Debug, PartialEq, Eq, DeriveEntityModel)]
#[sea_orm(table_name = "characters")]
pub struct Model {
    #[sea_orm(primary_key, auto_increment = false)]
    pub character_id: String,
    pub clan_id: String,
    pub name: String,
    pub title: String,
    pub fixed_traits: Json,
    pub visual_description: Json,
    #[sea_orm(column_type = "Text")]
    pub bust_prompt_description: String,
    pub artifact_name: String,
    #[sea_orm(column_type = "Text")]
    pub artifact_default_desc: String,
    #[sea_orm(column_type = "Text")]
    pub artifact_victory_desc: String,
    #[sea_orm(column_type = "Text")]
    pub artifact_defeat_desc: String,
    #[sea_orm(belongs_to, from = "clan_id", to = "clan_id")]
    pub clan: HasOne<super::clan::Entity>,
}

impl ActiveModelBehavior for ActiveModel {}

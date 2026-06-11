use sea_orm::entity::prelude::*;

#[sea_orm::model]
#[derive(Clone, Debug, PartialEq, Eq, DeriveEntityModel)]
#[sea_orm(table_name = "clans")]
pub struct Model {
    #[sea_orm(primary_key, auto_increment = false)]
    pub clan_id: String,
    pub universe_id: String,
    pub name: String,
    pub tagline: String,
    #[sea_orm(column_type = "Text")]
    pub silhouette: String,
    #[sea_orm(column_type = "Text")]
    pub border_accent: String,
    #[sea_orm(column_type = "Text")]
    pub typography_hint: String,
    #[sea_orm(column_type = "Text")]
    pub pip_texture: String,
    pub primary_dark: String,
    pub primary_accent: String,
    pub secondary: String,
    pub sigil: String,
    #[sea_orm(belongs_to, from = "universe_id", to = "universe_id")]
    pub universe: HasOne<super::universe::Entity>,
    #[sea_orm(has_many)]
    pub characters: HasMany<super::character::Entity>,
}

impl ActiveModelBehavior for ActiveModel {}

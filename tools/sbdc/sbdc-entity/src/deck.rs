use sea_orm::entity::prelude::*;

#[sea_orm::model]
#[derive(Clone, Debug, PartialEq, Eq, DeriveEntityModel)]
#[sea_orm(table_name = "decks")]
pub struct Model {
    #[sea_orm(primary_key, auto_increment = false)]
    pub deck_id: String,
    pub season_id: String,
    pub status: String,
    #[sea_orm(column_type = "Text")]
    pub art_style: String,
    #[sea_orm(column_type = "Text")]
    pub theme: String,
    pub junction_type: String,
    #[sea_orm(belongs_to, from = "season_id", to = "season_id")]
    pub season: HasOne<super::season::Entity>,
    #[sea_orm(has_many)]
    pub narrative_arcs: HasMany<super::deck_narrative_arc::Entity>,
    #[sea_orm(has_many)]
    pub prompts: HasMany<super::generated_prompt::Entity>,
}

impl ActiveModelBehavior for ActiveModel {}

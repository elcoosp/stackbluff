use sea_orm::entity::prelude::*;

#[sea_orm::model]
#[derive(Clone, Debug, PartialEq, Eq, DeriveEntityModel)]
#[sea_orm(table_name = "deck_narrative_arcs")]
pub struct Model {
    #[sea_orm(primary_key, auto_increment = false)]
    pub arc_id: String,
    pub deck_id: String,
    pub rank: String,
    pub suit: String,
    #[sea_orm(column_type = "Text")]
    pub description: String,
    pub step_order: i32,
    #[sea_orm(belongs_to, from = "deck_id", to = "deck_id")]
    pub deck: HasOne<super::deck::Entity>,
}

impl ActiveModelBehavior for ActiveModel {}

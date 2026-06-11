use sea_orm::entity::prelude::*;

#[sea_orm::model]
#[derive(Clone, Debug, PartialEq, Eq, DeriveEntityModel)]
#[sea_orm(table_name = "seasons")]
pub struct Model {
    #[sea_orm(primary_key, auto_increment = false)]
    pub season_id: String,
    pub universe_id: String,
    pub season_name: String,
    #[sea_orm(column_type = "Text")]
    pub global_event: String,
    pub season_order: i32,
    #[sea_orm(belongs_to, from = "universe_id", to = "universe_id")]
    pub universe: HasOne<super::universe::Entity>,
    #[sea_orm(has_many)]
    pub decks: HasMany<super::deck::Entity>,
}

impl ActiveModelBehavior for ActiveModel {}

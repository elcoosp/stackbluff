use sea_orm::entity::prelude::*;

#[sea_orm::model]
#[derive(Clone, Debug, PartialEq, Eq, DeriveEntityModel)]
#[sea_orm(table_name = "universe")]
pub struct Model {
    #[sea_orm(primary_key, auto_increment = false)]
    pub universe_id: String,
    #[sea_orm(column_type = "Text")]
    pub art_direction: String,
    #[sea_orm(column_type = "Text")]
    pub background_invariant: String,
    #[sea_orm(column_type = "Text")]
    pub lighting_invariant: String,
    #[sea_orm(column_type = "Text")]
    pub animation_philosophy: String,
    #[sea_orm(column_type = "Text")]
    pub hidden_gems_rule: String,
    #[sea_orm(column_type = "Text")]
    pub default_negative: String,
    #[sea_orm(has_many)]
    pub clans: HasMany<super::clan::Entity>,
    #[sea_orm(has_many)]
    pub seasons: HasMany<super::season::Entity>,
}

impl ActiveModelBehavior for ActiveModel {}

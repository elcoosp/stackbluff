use sea_orm::entity::prelude::*;

#[sea_orm::model]
#[derive(Clone, Debug, PartialEq, Eq, DeriveEntityModel)]
#[sea_orm(table_name = "generated_prompts")]
pub struct Model {
    #[sea_orm(primary_key)]
    pub prompt_id: i32,
    pub deck_id: String,
    pub target_card: String,
    pub target_layer: String,
    pub target_variant: String,
    #[sea_orm(column_type = "Text")]
    pub final_positive: String,
    #[sea_orm(column_type = "Text")]
    pub final_negative: String,
    pub status: String,
    pub target_file: String,
    #[sea_orm(belongs_to, from = "deck_id", to = "deck_id")]
    pub deck: HasOne<super::deck::Entity>,
    #[sea_orm(has_many)]
    pub takes: HasMany<super::prompt_take::Entity>,
}

impl ActiveModelBehavior for ActiveModel {}

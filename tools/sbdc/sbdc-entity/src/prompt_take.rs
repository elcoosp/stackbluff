use sea_orm::entity::prelude::*;

#[sea_orm::model]
#[derive(Clone, Debug, PartialEq, Eq, DeriveEntityModel)]
#[sea_orm(table_name = "prompt_takes")]
pub struct Model {
    #[sea_orm(primary_key)]
    pub take_id: i32,
    pub prompt_id: i32,
    #[sea_orm(column_type = "Text")]
    pub file_path: String,
    pub is_selected: bool,
    #[sea_orm(belongs_to, from = "prompt_id", to = "prompt_id")]
    pub prompt: HasOne<super::generated_prompt::Entity>,
}

impl ActiveModelBehavior for ActiveModel {}

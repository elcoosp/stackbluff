use sea_orm::entity::prelude::*;

#[sea_orm::model]
#[derive(Clone, Debug, PartialEq, Eq, DeriveEntityModel)]
#[sea_orm(table_name = "composition_schemas")]
pub struct Model {
    #[sea_orm(primary_key, auto_increment = false)]
    pub schema_id: String,
    pub name: String,
    pub layout_json: Json,
}

impl ActiveModelBehavior for ActiveModel {}

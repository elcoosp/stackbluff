use sea_orm::entity::prelude::*;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, FromJsonQueryResult)]
pub struct ClubProSettings {
    pub custom_banner: Option<String>,
    pub chip_design_preset: Option<String>,
    pub felt_color: Option<String>,
}

#[sea_orm::model]
#[derive(Clone, Debug, PartialEq, Eq, DeriveEntityModel, Serialize, Deserialize)]
#[sea_orm(table_name = "clubs")]
pub struct Model {
    #[sea_orm(primary_key, auto_increment = false)]
    pub id: Uuid,
    pub owner_id: Uuid,
    pub name: String,
    pub created_at: DateTimeUtc,
    pub is_founder_club: bool,
    #[sea_orm(column_type = "Json", nullable)]
    pub pro_settings_json: Option<ClubProSettings>,
    pub telegram_chat_id: Option<i64>,
}

impl ActiveModelBehavior for ActiveModel {}

use sea_orm::entity::prelude::*;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, FromJsonQueryResult)]
pub struct ClubProSettings {
    pub custom_banner: Option<String>,
    pub chip_design_preset: Option<String>,
    pub felt_color: Option<String>,
}

#[derive(Clone, Debug, PartialEq, Eq, DeriveEntityModel)]
#[sea_orm(table_name = "clubs")]
pub struct Model {
    #[sea_orm(primary_key, auto_increment = false)]
    pub id: Uuid,
    pub owner_id: Uuid,
    pub name: String,
    #[sea_orm(nullable)]
    pub logo_url: Option<String>,
    pub created_by: Uuid,
    pub is_founder_club: bool,
    #[sea_orm(column_type = "Json", nullable)]
    pub pro_settings_json: Option<ClubProSettings>,
    pub created_at: DateTimeUtc,
    pub updated_at: DateTimeUtc,
}

#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
pub enum Relation {
    #[sea_orm(has_many = "super::club_memberships::Entity")]
    Memberships,
}

impl Related<super::club_memberships::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::Memberships.def()
    }
}

impl ActiveModelBehavior for ActiveModel {}

//! SeaORM Entity for bot_ledger table.

use sea_orm::entity::prelude::*;

#[derive(Clone, Debug, PartialEq, DeriveEntityModel)]
#[sea_orm(table_name = "bot_ledger")]
pub struct Model {
    #[sea_orm(primary_key)]
    pub id: i64,
    pub bot_user_id: Uuid,
    pub table_id: Uuid,
    pub delta: i64,
    pub reason: String,
    pub created_at: DateTimeUtc,
}

#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
pub enum Relation {
    #[sea_orm(
        belongs_to = "crate::user::Entity",
        from = "Column::BotUserId",
        to = "crate::user::Column::Id"
    )]
    User,
}

impl Related<crate::user::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::User.def()
    }
}

impl ActiveModelBehavior for ActiveModel {
    fn new() -> Self {
        Self {
            created_at: sea_orm::ActiveValue::Set(chrono::Utc::now()),
            ..ActiveModelTrait::default()
        }
    }
}

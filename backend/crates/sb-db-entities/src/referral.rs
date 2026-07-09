use sea_orm::entity::prelude::*;

#[sea_orm::model]
#[derive(Clone, Debug, PartialEq, Eq, DeriveEntityModel)]
#[sea_orm(table_name = "referral")]
pub struct Model {
    #[sea_orm(primary_key)]
    pub referrer_id: String,
    #[sea_orm(primary_key)]
    pub referred_id: String,
    pub hand_count: i32,
    pub bonus_awarded: bool,
    pub created_at: DateTime,
}

impl ActiveModelBehavior for ActiveModel {}

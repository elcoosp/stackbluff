use sea_orm::entity::prelude::*;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[sea_orm::model]
#[derive(Clone, Debug, PartialEq, Eq, DeriveEntityModel, Serialize, Deserialize)]
#[sea_orm(table_name = "referrals")]
pub struct Model {
    #[sea_orm(primary_key)]
    pub referrer_id: Uuid,
    #[sea_orm(primary_key)]
    pub referred_id: Uuid,
    pub completed_at: Option<DateTimeUtc>,
    pub bonus_credited: bool,
}

impl ActiveModelBehavior for ActiveModel {}

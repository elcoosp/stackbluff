use crate::enums::SubscriptionEventType;
use sea_orm::entity::prelude::*;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[sea_orm::model]
#[derive(Clone, Debug, PartialEq, Eq, DeriveEntityModel, Serialize, Deserialize)]
#[sea_orm(table_name = "subscription_events")]
pub struct Model {
    #[sea_orm(primary_key, auto_increment = false)]
    pub id: Uuid,
    pub user_id: Uuid,
    pub product: String,
    pub event_type: SubscriptionEventType,
    pub occurred_at: DateTimeUtc,
    pub payment_id: Option<String>,
}

impl ActiveModelBehavior for ActiveModel {}

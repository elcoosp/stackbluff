use sea_orm::entity::prelude::*;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, PartialEq, Eq, EnumIter, DeriveActiveEnum, Serialize, Deserialize)]
#[sea_orm(rs_type = "String", db_type = "String(StringLen::N(20))")]
pub enum Platform {
    #[sea_orm(string_value = "pwa")]
    Pwa,
    #[sea_orm(string_value = "telegram")]
    Telegram,
}

#[derive(Debug, Clone, PartialEq, Eq, EnumIter, DeriveActiveEnum, Serialize, Deserialize)]
#[sea_orm(rs_type = "String", db_type = "String(StringLen::N(20))")]
pub enum TableStatus {
    #[sea_orm(string_value = "waiting")]
    Waiting,
    #[sea_orm(string_value = "playing")]
    Playing,
    #[sea_orm(string_value = "finished")]
    Finished,
}

#[derive(Debug, Clone, PartialEq, Eq, EnumIter, DeriveActiveEnum, Serialize, Deserialize)]
#[sea_orm(rs_type = "String", db_type = "String(StringLen::N(30))")]
pub enum SubscriptionEventType {
    #[sea_orm(string_value = "start")]
    Start,
    #[sea_orm(string_value = "renew")]
    Renew,
    #[sea_orm(string_value = "cancel")]
    Cancel,
    #[sea_orm(string_value = "expiry")]
    Expiry,
}

#[derive(Debug, Clone, PartialEq, Eq, EnumIter, DeriveActiveEnum, Serialize, Deserialize)]
#[sea_orm(rs_type = "String", db_type = "String(StringLen::N(20))")]
pub enum RankTier {
    #[sea_orm(string_value = "brick")]
    Brick,
    #[sea_orm(string_value = "bronze")]
    Bronze,
    #[sea_orm(string_value = "silver")]
    Silver,
    #[sea_orm(string_value = "gold")]
    Gold,
    #[sea_orm(string_value = "platinum")]
    Platinum,
    #[sea_orm(string_value = "diamond")]
    Diamond,
    #[sea_orm(string_value = "maestro")]
    Maestro,
    #[sea_orm(string_value = "legend")]
    Legend,
}

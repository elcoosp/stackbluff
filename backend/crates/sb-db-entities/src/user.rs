use crate::enums::Platform;
use sea_orm::entity::prelude::*;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Clone, Debug, PartialEq, Eq, DeriveEntityModel, Serialize, Deserialize)]
#[sea_orm(table_name = "users")]
pub struct Model {
    #[sea_orm(primary_key, auto_increment = false)]
    pub id: Uuid,
    pub telegram_id: Option<i64>,
    #[sea_orm(unique)]
    pub email: Option<String>,
    pub display_name: String,
    #[sea_orm(column_type = "BigInteger")]
    pub chip_balance: i64,
    pub is_bot: bool,
    pub bot_profile: Option<String>,
    // L-10 FIX: the migration defines `bot_bankroll NOT NULL DEFAULT 0`,
    // but the entity declared it as `Option<i64>`. That drift caused
    // confusing None handling in the bot economy and made the migration
    // seed bots with an "unset" bankroll. Keep the type aligned with the
    // schema so future writes/reads are unambiguous.
    pub bot_bankroll: i64,
    pub streak_count: i32,
    pub created_at: DateTimeUtc,
    pub updated_at: DateTimeUtc,
    pub platform: Platform,
    pub email_verified_at: Option<DateTimeUtc>,
    pub password_hash: Option<String>,
    pub password_changed_at: Option<DateTimeUtc>,
    pub registration_order: Option<i64>,
    #[sea_orm(nullable)]
    pub club_pro_expires_at: Option<DateTimeUtc>,
    pub season_pass_id: Option<Uuid>,
    pub season_pass_expires_at: Option<DateTimeUtc>,
    pub deleted_at: Option<chrono::NaiveDateTime>,

    pub push_subscription: Option<serde_json::Value>,
}

#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
pub enum Relation {}

impl ActiveModelBehavior for ActiveModel {}

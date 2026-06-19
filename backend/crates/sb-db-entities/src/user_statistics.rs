use sea_orm::entity::prelude::*;
use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, PartialEq, DeriveEntityModel, Serialize, Deserialize)]
#[sea_orm(table_name = "user_statistics")]
pub struct Model {
    #[sea_orm(primary_key, auto_increment = false)]
    pub user_id: String,
    pub hands_played: i32,
    pub hands_won: i32,
    pub vpip_hands: i32,
    pub pfr_hands: i32,
    pub preflop_fold_count: i32,
    pub showdowns: i32,
    pub showdown_wins: i32,
    #[sea_orm(column_name = "hands_without_showdown")]
    pub hands_won_without_showdown: i32,
    pub total_wagered: i64,
    pub total_won: i64,
    pub net_profit: i64,
    pub biggest_pot_won: i64,
    pub all_in_count: i32,
    pub bets: i32,
    pub raises: i32,
    pub calls: i32,
    pub last_hand_played_at: Option<String>,
    pub last_hand_id: Option<String>,
    pub last_updated_at: String,
    pub version: i32,
}

#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
pub enum Relation {}

impl ActiveModelBehavior for ActiveModel {}

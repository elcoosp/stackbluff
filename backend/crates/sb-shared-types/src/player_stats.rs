use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct PlayerStatsDto {
    pub user_id: String,
    pub display_name: Option<String>,
    pub hands_played: u64,
    pub hands_won: u64,
    pub win_rate: f32,
    pub vpip: f32,
    pub pfr: f32,
    pub aggression_factor: f32,
    pub showdowns: u64,
    pub showdown_wins: u64,
    pub wtsd: f32,
    pub total_wagered: i64,
    pub total_won: i64,
    pub net_profit: i64,
    pub biggest_pot_won: i64,
    pub all_in_count: u64,
    pub last_hand_played_at: Option<String>,
}

#[derive(Debug, Clone, Default)]
pub struct StatsDelta {
    pub user_id: String,
    pub hands_played: i32,
    pub hands_won: i32,
    pub vpip_hands: i32,
    pub pfr_hands: i32,
    pub preflop_fold_count: i32,
    pub showdowns: i32,
    pub showdown_wins: i32,
    pub hands_won_without_showdown: i32,
    pub total_wagered: i64,
    pub total_won: i64,
    pub net_profit: i64,
    pub biggest_pot_won: i64,
    pub all_in_count: i32,
    pub last_hand_id: Option<String>,
    pub bets: i32,
    pub raises: i32,
    pub calls: i32,
}

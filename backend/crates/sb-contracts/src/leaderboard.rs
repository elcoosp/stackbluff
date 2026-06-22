use crate::persistence_error::PersistenceError;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct LeaderboardEntry {
    pub user_id: String,
    pub display_name: String,
    pub total_chips_won: i64,
    pub rank: i64,
}

#[async_trait::async_trait]
pub trait LeaderboardQuery: Send + Sync {
    async fn get_global_leaderboard(
        &self,
        offset: u64,
        limit: u64,
    ) -> Result<Vec<LeaderboardEntry>, PersistenceError>;
}

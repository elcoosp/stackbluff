use std::sync::Arc;
use sb_contracts::leaderboard::LeaderboardQuery;
use sb_contracts::persistence_error::PersistenceError;
use sb_contracts::leaderboard::LeaderboardEntry;

pub struct DummyLeaderboard;

#[async_trait::async_trait]
impl LeaderboardQuery for DummyLeaderboard {
    async fn get_leaderboard(&self) -> Result<Vec<LeaderboardEntry>, PersistenceError> {
        Ok(vec![])
    }

    async fn get_global_leaderboard(&self, _limit: u64, _offset: u64) -> Result<Vec<LeaderboardEntry>, PersistenceError> {
        Ok(vec![])
    }
}

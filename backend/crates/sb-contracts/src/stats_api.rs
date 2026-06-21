use crate::repo_api::PersistenceError;
use async_trait::async_trait;
use sb_shared_types::player_stats::{PlayerStatsDto, StatsDelta};

#[async_trait]
pub trait PlayerStatsRepo: Send + Sync {
    async fn get(&self, user_id: &str) -> Result<PlayerStatsDto, PersistenceError>;
    async fn apply_delta(&self, delta: StatsDelta) -> Result<(), PersistenceError>;
}

use async_trait::async_trait;
use sb_contracts::user_resolution::{UserResolutionError, UserResolutionService};
use sb_shared_types::UserId;
use std::sync::Arc;
use moka::sync::Cache;
use uuid::Uuid;

pub struct InMemoryUserResolutionService {
    cache: Arc<Cache<String, UserId>>,
}

impl Default for InMemoryUserResolutionService {
    fn default() -> Self {
        Self::new()
    }
}

impl InMemoryUserResolutionService {
    pub fn new() -> Self {
        Self {
            cache: Arc::new(Cache::new(10_000)),
        }
    }
}

#[async_trait]
impl UserResolutionService for InMemoryUserResolutionService {
    async fn resolve_telegram_user(&self, telegram_id: &str) -> Result<UserId, UserResolutionError> {
        if let Some(user_id) = self.cache.get(telegram_id) {
            return Ok(user_id);
        }
        // Auto-create user for now
        let user_id = UserId::from(Uuid::new_v4());
        self.cache.insert(telegram_id.to_string(), user_id);
        Ok(user_id)
    }
}

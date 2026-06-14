use async_trait::async_trait;
use sb_contracts::user_resolution::{UserResolutionError, UserResolutionService};
use sb_shared_types::UserId;
use moka::sync::Cache;
use uuid::Uuid;

pub struct InMemoryUserResolutionService {
    cache: Cache<String, UserId>,
}

impl InMemoryUserResolutionService {
    pub fn new() -> Self {
        Self {
            cache: Cache::new(10_000),
        }
    }
}

#[async_trait]
impl UserResolutionService for InMemoryUserResolutionService {
    async fn resolve_telegram_user(&self, telegram_id: &str) -> Result<UserId, UserResolutionError> {
        if let Some(user_id) = self.cache.get(telegram_id) {
            return Ok(user_id);
        }
        if telegram_id.parse::<u64>().is_ok() {
            let user_id = UserId::new(Uuid::new_v4());
            self.cache.insert(telegram_id.to_string(), user_id);
            Ok(user_id)
        } else {
            tracing::warn!("Telegram user {} not linked", telegram_id);
            Err(UserResolutionError::TelegramNotLinked)
        }
    }
}

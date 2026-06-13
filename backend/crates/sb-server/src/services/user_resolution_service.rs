use async_trait::async_trait;
use sb_contracts::user_resolution::{UserResolutionService, UserResolutionError};
use sb_shared_types::ids::UserId;
use moka::sync::Cache;
use uuid::Uuid;
use tracing::warn;

pub struct CachedUserResolutionService {
    cache: Cache<String, UserId>,
}

impl CachedUserResolutionService {
    pub fn new() -> Self {
        Self {
            cache: Cache::builder()
                .time_to_live(std::time::Duration::from_secs(60))
                .build(),
        }
    }

    fn resolve_inner(&self, telegram_id: &str) -> Option<UserId> {
        if telegram_id.parse::<u64>().is_ok() {
            Some(UserId::from_uuid(Uuid::new_v4()))
        } else {
            None
        }
    }
}

#[async_trait]
impl UserResolutionService for CachedUserResolutionService {
    async fn resolve_telegram_user(&self, telegram_id: &str) -> Result<UserId, UserResolutionError> {
        if let Some(user_id) = self.cache.get(telegram_id) {
            return Ok(user_id);
        }
        if let Some(user_id) = self.resolve_inner(telegram_id) {
            self.cache.insert(telegram_id.to_string(), user_id);
            Ok(user_id)
        } else {
            warn!("Telegram user {} not linked", telegram_id);
            Err(UserResolutionError::TelegramNotLinked)
        }
    }
}

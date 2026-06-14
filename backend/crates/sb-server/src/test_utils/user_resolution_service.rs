//! In-memory user resolution service stub for testing.

#[cfg(feature = "test-stubs")]
use async_trait::async_trait;
#[cfg(feature = "test-stubs")]
use moka::sync::Cache;
#[cfg(feature = "test-stubs")]
use sb_contracts::user_resolution::{UserResolutionError, UserResolutionService};
#[cfg(feature = "test-stubs")]
use sb_shared_types::UserId;
#[cfg(feature = "test-stubs")]
use uuid::Uuid;

#[cfg(feature = "test-stubs")]
pub struct InMemoryUserResolutionService {
    cache: Cache<String, UserId>,
}

#[cfg(feature = "test-stubs")]
impl InMemoryUserResolutionService {
    pub fn new() -> Self {
        Self {
            cache: Cache::new(10_000),
        }
    }
}

#[cfg(feature = "test-stubs")]
#[async_trait]
impl UserResolutionService for InMemoryUserResolutionService {
    async fn resolve_telegram_user(
        &self,
        telegram_id: &str,
    ) -> Result<UserId, UserResolutionError> {
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

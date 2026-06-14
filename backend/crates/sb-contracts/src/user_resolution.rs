use async_trait::async_trait;
use sb_shared_types::ids::UserId;
use thiserror::Error;

#[derive(Error, Debug)]
pub enum UserResolutionError {
    #[error("User not found")]
    NotFound,
    #[error("Telegram user not linked")]
    TelegramNotLinked,
    #[error("Internal error: {0}")]
    Internal(String),
}

#[async_trait]
pub trait UserResolutionService: Send + Sync {
    async fn resolve_telegram_user(&self, telegram_id: &str)
    -> Result<UserId, UserResolutionError>;
}

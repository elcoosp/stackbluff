use async_trait::async_trait;
use sb_shared_types::AppError;

/// Trait for sending emails - enables mocking in tests
#[async_trait]
pub trait EmailSender: Send + Sync {
    async fn send_verification_email(&self, to: &str, token: &str) -> Result<(), AppError>;
    async fn send_password_reset_email(&self, to: &str, token: &str) -> Result<(), AppError>;
}

//! Notification service contract. Lives in its own module
//! to avoid coupling unrelated domains.

use async_trait::async_trait;
use sb_shared_types::UserId;

/// Error type for notification operations.
#[derive(Debug, thiserror::Error)]
pub enum NotificationError {
    #[error("notification failed: {0}")]
    Failed(String),
}

/// Service for sending notifications.
#[async_trait]
pub trait NotificationService: Send + Sync {
    async fn send_telegram_message(
        &self,
        chat_id: i64,
        text: String,
        keyboard: Option<serde_json::Value>,
    ) -> Result<(), NotificationError>;

    async fn send_telegram_message_to_user(
        &self,
        user_id: UserId,
        text: String,
        keyboard: Option<serde_json::Value>,
    ) -> Result<(), NotificationError>;

    async fn answer_callback_query(
        &self,
        callback_query_id: String,
        text: Option<String>,
    ) -> Result<(), NotificationError>;
}

#[derive(Debug, Clone)]
pub enum NotificationEvent {
    SeasonCardReady {
        season_id: i32,
        card_url: Option<String>,
    },
}

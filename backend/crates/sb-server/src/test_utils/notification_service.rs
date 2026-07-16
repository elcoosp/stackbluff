//! In-memory notification service stub for testing.

use async_trait::async_trait;
use parking_lot::RwLock;
use sb_contracts::notification_api::{NotificationError, NotificationService};
use sb_shared_types::UserId;
use std::sync::Arc;
use tracing::info;

pub struct InMemoryNotificationService {
    pub last_telegram_messages: Arc<RwLock<std::collections::HashMap<i64, String>>>,
}

impl InMemoryNotificationService {
    pub fn new() -> Self {
        Self {
            last_telegram_messages: Arc::new(RwLock::new(std::collections::HashMap::new())),
        }
    }
}

#[async_trait]
impl NotificationService for InMemoryNotificationService {
    async fn send_telegram_message(
        &self,
        chat_id: i64,
        text: String,
        _keyboard: Option<serde_json::Value>,
    ) -> Result<(), NotificationError> {
        info!(chat_id, "Sending telegram message: {}", text);
        self.last_telegram_messages.write().insert(chat_id, text);
        Ok(())
    }

    async fn send_telegram_message_to_user(
        &self,
        user_id: UserId,
        text: String,
        _keyboard: Option<serde_json::Value>,
    ) -> Result<(), NotificationError> {
        info!(user_id = %user_id, "Sending message to user: {}", text);
        Ok(())
    }

    async fn answer_callback_query(
        &self,
        callback_query_id: String,
        _text: Option<String>,
    ) -> Result<(), NotificationError> {
        info!(callback_query_id, "Answering callback query");
        Ok(())
    }
}

// ── ClubNotifier implementation for test stubs ──────────────────────────
#[async_trait::async_trait]
impl sb_contracts::notification_api::ClubNotifier for InMemoryNotificationService {
    async fn send_club_reminder(
        &self,
        club_id: sb_shared_types::ClubId,
        message: String,
    ) -> Result<(), sb_shared_types::errors::AppError> {
        tracing::info!(%club_id, message, "InMemoryNotificationService::send_club_reminder");
        Ok(())
    }
}

#[async_trait::async_trait]
impl sb_contracts::notification::NotificationService for InMemoryNotificationService {
    async fn send(
        &self,
        _ctx: &sb_shared_types::RequestContext,
        user_id: sb_shared_types::UserId,
        event: sb_contracts::notification::NotificationEvent,
    ) -> Result<(), sb_shared_types::errors::AppError> {
        tracing::info!(?user_id, ?event, "InMemoryNotificationService::send");
        Ok(())
    }
}

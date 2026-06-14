use async_trait::async_trait;
use sb_contracts::service_api::NotificationService;
use sb_contracts::PersistenceError;
use sb_shared_types::UserId;
use std::sync::Arc;
use parking_lot::RwLock;
use tracing::info;

pub struct InMemoryNotificationService {
    pub last_telegram_messages: Arc<RwLock<std::collections::HashMap<i64, String>>>,
}

impl Default for InMemoryNotificationService {
    fn default() -> Self {
        Self::new()
    }
}

impl InMemoryNotificationService {
    pub fn new() -> Self {
        Self { last_telegram_messages: Arc::new(RwLock::new(std::collections::HashMap::new())) }
    }
}

#[async_trait]
impl NotificationService for InMemoryNotificationService {
    async fn send_telegram_message(
        &self,
        chat_id: i64,
        text: String,
        _keyboard: Option<serde_json::Value>,
    ) -> Result<(), PersistenceError> {
        info!(chat_id, "Sending telegram message: {}", text);
        self.last_telegram_messages.write().insert(chat_id, text);
        Ok(())
    }

    async fn send_telegram_message_to_user(
        &self,
        user_id: UserId,
        text: String,
        _keyboard: Option<serde_json::Value>,
    ) -> Result<(), PersistenceError> {
        info!(user_id = %user_id, "Sending message to user: {}", text);
        Ok(())
    }

    async fn answer_callback_query(
        &self,
        callback_query_id: String,
        _text: Option<String>,
    ) -> Result<(), PersistenceError> {
        info!(callback_query_id, "Answering callback query");
        Ok(())
    }
}

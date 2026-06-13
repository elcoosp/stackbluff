use async_trait::async_trait;
use sb_contracts::service_api::NotificationService;
use sb_contracts::persistence_error::PersistenceError;
use sb_shared_types::ids::UserId;
use std::collections::HashMap;
use parking_lot::RwLock;
use tracing::info;

pub struct InMemoryNotificationService {
    pub last_telegram_messages: RwLock<HashMap<i64, String>>,
}

impl InMemoryNotificationService {
    pub fn new() -> Self {
        Self { last_telegram_messages: RwLock::new(HashMap::new()) }
    }
}

#[async_trait]
impl NotificationService for InMemoryNotificationService {
    async fn send_telegram_message(&self, chat_id: i64, text: String, _keyboard: Option<serde_json::Value>) -> Result<(), PersistenceError> {
        info!("[TELEGRAM] To chat {}: {}", chat_id, text);
        self.last_telegram_messages.write().insert(chat_id, text);
        Ok(())
    }

    async fn send_telegram_message_to_user(&self, user_id: UserId, text: String, _keyboard: Option<serde_json::Value>) -> Result<(), PersistenceError> {
        info!("[TELEGRAM] To user {}: {}", user_id, text);
        Ok(())
    }

    async fn answer_callback_query(&self, callback_query_id: String, _text: Option<String>) -> Result<(), PersistenceError> {
        info!("[TELEGRAM] Answer callback query: {}", callback_query_id);
        Ok(())
    }
}

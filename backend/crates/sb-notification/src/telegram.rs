use async_trait::async_trait;
use reqwest::Client;
use sb_contracts::notification_api::{NotificationError, NotificationService};
use sb_contracts::repo_api::{ClubRepo, UserRepo};
use sb_shared_types::{AppError, ClubId, RequestContext, UserId};
use serde_json::json;
use std::sync::Arc;
use tracing::{error, info};

pub struct TelegramNotificationService {
    bot_token: String,
    http_client: Client,
    user_repo: Option<Arc<dyn UserRepo + Send + Sync>>,
    club_repo: Option<Arc<dyn ClubRepo + Send + Sync>>,
}

impl TelegramNotificationService {
    pub fn new(bot_token: String) -> Self {
        Self {
            bot_token,
            http_client: Client::new(),
            user_repo: None,
            club_repo: None,
        }
    }

    pub fn with_user_repo(mut self, repo: Arc<dyn UserRepo + Send + Sync>) -> Self {
        self.user_repo = Some(repo);
        self
    }

    pub fn with_club_repo(mut self, repo: Arc<dyn ClubRepo + Send + Sync>) -> Self {
        self.club_repo = Some(repo);
        self
    }

    async fn send_message(
        &self,
        chat_id: i64,
        text: &str,
        keyboard: Option<serde_json::Value>,
    ) -> Result<(), NotificationError> {
        let url = format!("https://api.telegram.org/bot{}/sendMessage", self.bot_token);

        let mut payload = json!({
            "chat_id": chat_id,
            "text": text,
            "parse_mode": "Markdown",
        });

        if let Some(kb) = keyboard {
            payload["reply_markup"] = kb;
        }

        let response = self
            .http_client
            .post(&url)
            .json(&payload)
            .send()
            .await
            .map_err(|e| NotificationError::Failed(format!("Telegram request failed: {}", e)))?;

        if !response.status().is_success() {
            let status = response.status();
            let error_text = response
                .text()
                .await
                .unwrap_or_else(|_| "Unknown error".to_string());
            error!("Telegram API error: status={}, body={}", status, error_text);
            return Err(NotificationError::Failed(format!(
                "Telegram API returned {}: {}",
                status, error_text
            )));
        }

        info!(chat_id, "Telegram message sent successfully");
        Ok(())
    }

    async fn resolve_user_chat_id(&self, user_id: UserId) -> Result<i64, NotificationError> {
        let repo = self
            .user_repo
            .as_ref()
            .ok_or_else(|| NotificationError::Failed("User repo not configured".to_string()))?;
        let ctx = RequestContext::new(uuid::Uuid::new_v4(), Some(user_id));
        let profile = repo
            .get_user_profile(ctx, user_id)
            .await
            .map_err(|e| NotificationError::Failed(format!("User lookup failed: {}", e)))?;
        // For Telegram users, we stored the telegram_id as a separate field.
        // The current UserProfile doesn't have telegram_id; we need to add it.
        // As a workaround, we'll assume that if platform is "telegram", we can use the user_id as chat_id?
        // This is a temporary solution. In production we should store telegram_id in the users table.
        // We'll use the user_id as a fallback but log a warning.
        // The proper way is to have a `telegram_id` field.
        // For now, we'll use the user_id as chat_id (assuming it's the same).
        // This is not correct, but we'll fix later by adding telegram_id to UserProfile.
        // We'll return an error for now.
        error!(%user_id, "Telegram chat ID resolution not yet fully implemented");
        Err(NotificationError::Failed(
            "Telegram ID not available in user profile".to_string(),
        ))
    }
}

#[async_trait]
impl NotificationService for TelegramNotificationService {
    async fn send_telegram_message(
        &self,
        chat_id: i64,
        text: String,
        keyboard: Option<serde_json::Value>,
    ) -> Result<(), NotificationError> {
        self.send_message(chat_id, &text, keyboard).await
    }

    async fn send_telegram_message_to_user(
        &self,
        user_id: UserId,
        text: String,
        keyboard: Option<serde_json::Value>,
    ) -> Result<(), NotificationError> {
        let chat_id = self.resolve_user_chat_id(user_id).await?;
        self.send_message(chat_id, &text, keyboard).await
    }

    async fn answer_callback_query(
        &self,
        callback_query_id: String,
        text: Option<String>,
    ) -> Result<(), NotificationError> {
        let url = format!(
            "https://api.telegram.org/bot{}/answerCallbackQuery",
            self.bot_token
        );

        let mut payload = json!({
            "callback_query_id": callback_query_id,
        });

        if let Some(t) = text {
            payload["text"] = json!(t);
        }

        let response = self
            .http_client
            .post(&url)
            .json(&payload)
            .send()
            .await
            .map_err(|e| NotificationError::Failed(format!("Telegram request failed: {}", e)))?;

        if !response.status().is_success() {
            let status = response.status();
            let error_text = response
                .text()
                .await
                .unwrap_or_else(|_| "Unknown error".to_string());
            error!(
                "Telegram callback API error: status={}, body={}",
                status, error_text
            );
            return Err(NotificationError::Failed(format!(
                "Telegram API returned {}: {}",
                status, error_text
            )));
        }

        info!(callback_query_id, "Callback query answered");
        Ok(())
    }
}

#[async_trait::async_trait]
impl sb_contracts::notification_api::ClubNotifier for TelegramNotificationService {
    async fn send_club_reminder(&self, club_id: ClubId, message: String) -> Result<(), AppError> {
        let repo = self
            .club_repo
            .as_ref()
            .ok_or_else(|| AppError::Configuration("ClubRepo not set".to_string()))?;
        let chat_id = repo
            .get_telegram_chat_id(club_id)
            .await
            .map_err(|e| AppError::Internal(e.to_string()))?
            .ok_or_else(|| AppError::NotFound("Club Telegram chat not found".into()))?;
        self.send_message(chat_id, &message, None)
            .await
            .map_err(|e| AppError::Internal(e.to_string()))?;
        Ok(())
    }
}

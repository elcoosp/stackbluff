use async_trait::async_trait;
use sb_contracts::notification_api::{NotificationError, NotificationService, ClubNotifier};
use sb_contracts::notification::NotificationEvent;
use sb_db_repos::push_subscription_repo::PushSubscriptionRepo;
use sb_shared_types::{errors::AppError, RequestContext, UserId, ClubId};
use std::sync::Arc;
use crate::web_push::{WebPushSender, SendOutcome};

pub struct MultiChannelNotifier {
    pub telegram: Arc<dyn NotificationService>,
    pub push_sender: Arc<WebPushSender>,
    pub push_repo: Arc<dyn PushSubscriptionRepo>,
}

impl MultiChannelNotifier {
    pub fn new(
        telegram: Arc<dyn NotificationService>,
        push_sender: Arc<WebPushSender>,
        push_repo: Arc<dyn PushSubscriptionRepo>,
    ) -> Self {
        Self {
            telegram,
            push_sender,
            push_repo,
        }
    }
}

#[async_trait]
impl NotificationService for MultiChannelNotifier {
    async fn send_telegram_message(
        &self,
        chat_id: i64,
        text: String,
        keyboard: Option<serde_json::Value>,
    ) -> Result<(), NotificationError> {
        self.telegram.send_telegram_message(chat_id, text, keyboard).await
    }

    async fn send_telegram_message_to_user(
        &self,
        user_id: UserId,
        text: String,
        keyboard: Option<serde_json::Value>,
    ) -> Result<(), NotificationError> {
        self.telegram.send_telegram_message_to_user(user_id, text, keyboard).await
    }

    async fn answer_callback_query(
        &self,
        callback_query_id: String,
        text: Option<String>,
    ) -> Result<(), NotificationError> {
        self.telegram.answer_callback_query(callback_query_id, text).await
    }
}

#[async_trait]
impl sb_contracts::notification::NotificationService for MultiChannelNotifier {
    async fn send(
        &self,
        ctx: &RequestContext,
        user_id: UserId,
        event: NotificationEvent,
    ) -> Result<(), AppError> {
        let _ = self.telegram.send(ctx, user_id, event.clone()).await;

        let subs = self
            .push_repo
            .list_for_user(user_id.0)
            .await
            .map_err(|e| AppError::Internal(e.to_string()))?;

        let payload = serde_json::to_string(&event).unwrap_or_else(|_| "{}".to_string());

        for sub in subs {
            let sender = self.push_sender.clone();
            let repo = self.push_repo.clone();
            let p = payload.clone();
            tokio::spawn(async move {
                match sender.send(&sub, p).await {
                    Ok(SendOutcome::Gone) => {
                        let _ = repo.delete_by_endpoint(sub.endpoint).await;
                    }
                    Err(e) => tracing::error!("Web push failed: {}", e),
                    _ => {}
                }
            });
        }
        Ok(())
    }
}

#[async_trait]
impl ClubNotifier for MultiChannelNotifier {
    async fn send_club_reminder(
        &self,
        club_id: ClubId,
        message: String,
    ) -> Result<(), AppError> {
        self.telegram.send_club_reminder(club_id, message).await
    }
}

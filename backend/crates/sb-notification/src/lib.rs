pub mod telegram;
pub mod web_push;

use async_trait::async_trait;
use sb_contracts::notification::{NotificationEvent, NotificationService};
use sb_shared_types::{
    errors::AppError,
    ids::UserId,
    request_context::RequestContext,
};
use serde::{Deserialize, Serialize};
use tracing::info;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UserNotificationInfo {
    pub platform: Option<String>,
    pub push_subscription: Option<serde_json::Value>,
}

#[async_trait]
pub trait UserLookup: Send + Sync {
    async fn find_by_id(&self, ctx: &RequestContext, user_id: UserId) -> Result<UserNotificationInfo, AppError>;
}

pub struct NotificationRouter {
    user_lookup: Box<dyn UserLookup>,
    telegram_sender: telegram::TelegramSender,
    web_push_sender: web_push::WebPushSender,
}

impl NotificationRouter {
    pub fn new(
        user_lookup: Box<dyn UserLookup>,
        telegram_sender: telegram::TelegramSender,
        web_push_sender: web_push::WebPushSender,
    ) -> Self {
        Self { user_lookup, telegram_sender, web_push_sender }
    }
}

#[async_trait]
impl NotificationService for NotificationRouter {
    async fn send(
        &self,
        ctx: &RequestContext,
        user_id: UserId,
        event: NotificationEvent,
    ) -> Result<(), AppError> {
        let user = self.user_lookup.find_by_id(ctx, user_id).await?;
        match user.platform.as_deref() {
            Some("telegram") => {
                info!(?user_id, "Sending Telegram notification");
                self.telegram_sender.send(user_id, &event).await
            }
            Some("pwa") => {
                if user.push_subscription.is_some() {
                    info!(?user_id, "Sending Web Push notification");
                    self.web_push_sender.send(user_id, &user.push_subscription, &event).await
                } else {
                    info!(?user_id, "PWA user missing push subscription, skipping");
                    Ok(())
                }
            }
            other => {
                info!(?user_id, ?other, "No notification platform, skipping");
                Ok(())
            }
        }
    }
}

pub fn validate_subscription(payload: &serde_json::Value) -> Result<(), AppError> {
    if payload.get("endpoint").is_none() {
        return Err(AppError::External("Missing endpoint".into()));
    }
    Ok(())
}

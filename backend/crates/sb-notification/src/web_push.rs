use sb_contracts::notification::NotificationEvent;
use sb_shared_types::{errors::AppError, ids::UserId};

pub struct WebPushSender {
    #[allow(dead_code)]
    vapid_private_key: String,
    #[allow(dead_code)]
    vapid_subject: String,
}

impl WebPushSender {
    pub fn new(vapid_private_key: String, vapid_subject: String) -> Self {
        Self {
            vapid_private_key,
            vapid_subject,
        }
    }

    #[tracing::instrument(skip_all)]
    pub async fn send(
        &self,
        _user_id: UserId,
        _subscription_json: &Option<serde_json::Value>,
        event: &NotificationEvent,
    ) -> Result<(), AppError> {
        tracing::info!(?event, "WebPush stub send");
        Ok(())
    }
}

use sb_contracts::notification::NotificationEvent;
use sb_shared_types::{errors::AppError, ids::UserId};
use serde_json::json;
use web_push::*;

pub struct WebPushSender {
    vapid_private_key: String,
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
        subscription_json: &Option<serde_json::Value>,
        event: &NotificationEvent,
    ) -> Result<(), AppError> {
        let sub_json = subscription_json.as_ref().ok_or_else(|| {
            AppError::InvalidInput("No push subscription for user".into())
        })?;

        let subscription: SubscriptionInfo = serde_json::from_value(sub_json.clone())
            .map_err(|e| AppError::InvalidInput(format!("Invalid subscription: {}", e)))?;

        let (title, body) = match event {
            NotificationEvent::TournamentReminder { tournament_name, start_time, deep_link } => {
                (format!("Tournament Reminder: {}", tournament_name),
                 format!("{} starts at {}\nJoin now: {}", tournament_name, start_time, deep_link))
            }
            NotificationEvent::StreakAlert { streak_count } => {
                ("Streak Alert!".to_string(), format!("You're on a {} day streak! Keep it up!", streak_count))
            }
            NotificationEvent::ReferralBonus { from_user_id: _, amount } => {
                ("Referral Bonus Earned".to_string(), format!("You received {} chips from a referral!", amount))
            }
            NotificationEvent::MissionComplete { mission_name } => {
                ("Mission Complete!".to_string(), format!("You completed '{}'!", mission_name))
            }
        };

        let payload = json!({
            "title": title,
            "body": body,
            "icon": "/icon-192.png",
            "badge": "/badge-72.png",
            "tag": "stackbluff-notification",
            "data": {
                "url": "/"
            },
            "vibrate": [200, 100, 200]
        });

        let payload_bytes = serde_json::to_vec(&payload)
            .map_err(|e| AppError::Internal(format!("Failed to serialize payload: {}", e)))?;

        let mut builder = VapidSignatureBuilder::from_pem(
            self.vapid_private_key.as_bytes(),
            &subscription,
        )
        .map_err(|e| AppError::Internal(format!("VAPID key error: {}", e)))?;

        builder.add_claim("sub", self.vapid_subject.clone());

        let vapid_signature = builder.build()
            .map_err(|e| AppError::Internal(format!("VAPID build error: {}", e)))?;

        let mut msg_builder = WebPushMessageBuilder::new(&subscription);
        msg_builder.set_payload(ContentEncoding::Aes128Gcm, &payload_bytes);
        msg_builder.set_vapid_signature(vapid_signature);

        let message = msg_builder.build()
            .map_err(|e| AppError::Internal(format!("Failed to build message: {}", e)))?;

        let client = IsahcWebPushClient::new()
            .map_err(|e| AppError::Internal(format!("Failed to create push client: {}", e)))?;
        client.send(message).await
            .map_err(|e| AppError::External(format!("Push notification failed: {}", e)))?;

        tracing::info!("Push notification sent successfully");
        Ok(())
    }
}

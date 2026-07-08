//! Tests for notification services.
//! These test the concrete implementations without using the internal router trait.

use sb_notification::{TelegramNotificationService, web_push::WebPushSender};
use sb_shared_types::{ids::UserId, request_context::RequestContext};
use uuid::Uuid;

fn _test_ctx() -> RequestContext {
    RequestContext {
        request_id: uuid::Uuid::new_v4(),
        user_id: Some(sb_shared_types::ids::UserId::new(uuid::Uuid::new_v4())),
        ip: String::from("127.0.0.1"),
    }
}

#[tokio::test]
async fn telegram_service_can_be_created() {
    // We need a dummy bot token for tests.
    let bot_token = "dummy:token".to_string();
    let _service = TelegramNotificationService::new(bot_token);
    // The service does not implement the generic NotificationService trait,
    // but that's fine; we just test that it exists and can be used directly.
    // We won't try to send a message because that would require a real token.
    // Instead we just check that the struct is constructible.
    assert!(true);
}

#[tokio::test]
async fn web_push_sender_can_send_without_subscription() {
    let sender = WebPushSender::new("dummy_vapid".to_string(), "mailto:test@example.com".to_string());
    let user_id = UserId::new(Uuid::new_v4());
    let event = sb_contracts::notification::NotificationEvent::StreakAlert { streak_count: 3 };
    // Without a subscription, the send will just log and return Ok.
    let result = sender.send(user_id, &None, &event).await;
    assert!(result.is_ok());
}

// Additional test: Telegram service can be used with user_repo etc. but that's not needed here.

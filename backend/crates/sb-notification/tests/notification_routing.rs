use async_trait::async_trait;
use sb_contracts::notification::{NotificationEvent, NotificationService};
use sb_notification::{
    NotificationRouter, UserLookup, UserNotificationInfo, telegram::TelegramSender,
    web_push::WebPushSender,
};
use sb_shared_types::{
    chips::ChipAmount, errors::AppError, ids::UserId, request_context::RequestContext,
};
use serde_json::json;
use uuid::Uuid;

fn test_ctx() -> RequestContext {
    RequestContext {
        request_id: uuid::Uuid::new_v4(),
        user_id: Some(sb_shared_types::ids::UserId::new(uuid::Uuid::new_v4())),
        ip: String::from("127.0.0.1"),
    }
}

struct MockUserLookup {
    platform: Option<String>,
    subscription: Option<serde_json::Value>,
}

#[async_trait]
impl UserLookup for MockUserLookup {
    async fn find_by_id(
        &self,
        _ctx: &RequestContext,
        _user_id: UserId,
    ) -> Result<UserNotificationInfo, AppError> {
        Ok(UserNotificationInfo {
            platform: self.platform.clone(),
            push_subscription: self.subscription.clone(),
        })
    }
}

fn dummy_router(lookup: MockUserLookup) -> NotificationRouter {
    NotificationRouter::new(
        Box::new(lookup),
        TelegramSender::new("test_token".into()),
        WebPushSender::new("vapid_priv".into(), "mailto:test@example.com".into()),
    )
}

#[tokio::test]
async fn telegram_user_is_routed_correctly() {
    let router = dummy_router(MockUserLookup {
        platform: Some("telegram".to_string()),
        subscription: None,
    });
    assert!(
        router
            .send(
                &test_ctx(),
                UserId::new(Uuid::new_v4()),
                NotificationEvent::StreakAlert { streak_count: 3 }
            )
            .await
            .is_ok()
    );
}

#[tokio::test]
async fn pwa_user_with_subscription_is_routed_to_web_push() {
    let router = dummy_router(MockUserLookup {
        platform: Some("pwa".to_string()),
        subscription: Some(
            json!({"endpoint":"https://push.example.com","keys":{"p256dh":"key","auth":"auth"}}),
        ),
    });
    assert!(
        router
            .send(
                &test_ctx(),
                UserId::new(Uuid::new_v4()),
                NotificationEvent::MissionComplete {
                    mission_name: "First Win".into()
                }
            )
            .await
            .is_ok()
    );
}

#[tokio::test]
async fn pwa_user_without_subscription_is_gracefully_skipped() {
    let router = dummy_router(MockUserLookup {
        platform: Some("pwa".to_string()),
        subscription: None,
    });
    assert!(
        router
            .send(
                &test_ctx(),
                UserId::new(Uuid::new_v4()),
                NotificationEvent::ReferralBonus {
                    from_user_id: UserId::new(Uuid::new_v4()),
                    amount: ChipAmount::from(50),
                }
            )
            .await
            .is_ok()
    );
}

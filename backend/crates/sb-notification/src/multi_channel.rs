//! Multi-channel notifier.
//!
//! B-10 FIX (redesign): earlier drafts of this module tried to implement
//! a hypothetical high-level `NotificationService` (event-based) that
//! does not match what the codebase actually uses. Every call site in
//! tournament, bot-handler and reminder paths depends on the *low-level*
//! `sb_contracts::notification_api::NotificationService` trait:
//!
//!   * `send_telegram_message(chat_id, text, keyboard)`
//!   * `send_telegram_message_to_user(user_id, text, keyboard)`
//!   * `answer_callback_query(id, text)`
//!
//! This module now implements exactly that trait, delegating Telegram
//! calls to a `TelegramNotificationService` and fanning out a Web Push
//! to the user's registered subscriptions on the *user-targeted* path.
//! The chat-id-targeted path is not fanned out because we have no
//! stable user id to look up subscriptions for.
//!
//! `ClubNotifier` is also implemented by delegation.

use async_trait::async_trait;
use std::sync::Arc;
use tracing::{debug, warn};

use sb_contracts::notification_api::{ClubNotifier, NotificationError, NotificationService};
use sb_db_repos::push_subscription_repo::PushSubscriptionRepo;
use sb_shared_types::{errors::AppError, ClubId, UserId};

use crate::telegram::TelegramNotificationService;
use crate::web_push::{SendOutcome, WebPushSender};

pub struct MultiChannelNotifier {
    telegram: Arc<TelegramNotificationService>,
    push_sender: Option<Arc<WebPushSender>>,
    push_repo: Option<Arc<dyn PushSubscriptionRepo>>,
    /// Base URL used to build link targets inside push payloads.
    app_base_url: String,
}

impl MultiChannelNotifier {
    pub fn new(telegram: Arc<TelegramNotificationService>) -> Self {
        Self {
            telegram,
            push_sender: None,
            push_repo: None,
            app_base_url: std::env::var("APP_BASE_URL")
                .unwrap_or_else(|_| "http://localhost:3000".into()),
        }
    }

    /// Attach Web Push fanout. Called only when VAPID keys and a push
    /// subscription repo are available.
    pub fn with_web_push(
        mut self,
        sender: Arc<WebPushSender>,
        repo: Arc<dyn PushSubscriptionRepo>,
    ) -> Self {
        self.push_sender = Some(sender);
        self.push_repo = Some(repo);
        self
    }

    /// Fan a user-facing message out to every registered push subscription.
    /// Delivery is best-effort: failures are logged, never propagated.
    async fn fanout_push(&self, user_id: UserId, body: String) {
        let (Some(sender), Some(repo)) = (self.push_sender.as_ref(), self.push_repo.as_ref())
        else {
            return;
        };

        let subs = match repo.list_for_user(user_id.0).await {
            Ok(s) => s,
            Err(e) => {
                warn!(%user_id, error = %e, "push fanout: list subscriptions failed");
                return;
            }
        };
        if subs.is_empty() {
            return;
        }

        // A small default payload — title is the app name, body is the
        // notification text. Uses the same shape as the client SW handler.
        let payload = serde_json::json!({
            "title": "StackBluff",
            "body": body,
            "url": self.app_base_url,
        })
        .to_string();

        for sub in subs {
            let sender = sender.clone();
            let repo = repo.clone();
            let payload = payload.clone();
            // Best-effort: spawn so one slow endpoint cannot stall the
            // caller. Clean up subscriptions the push service rejects as
            // gone.
            tokio::spawn(async move {
                match sender.send(&sub, payload).await {
                    Ok(SendOutcome::Gone) => {
                        let _ = repo.delete_by_endpoint(sub.endpoint.clone()).await;
                    }
                    Ok(_) => {}
                    Err(e) => {
                        debug!(endpoint = %sub.endpoint, error = %e, "push delivery failed");
                    }
                }
            });
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
        // No user id → no push fanout. Pure Telegram path.
        self.telegram
            .send_telegram_message(chat_id, text, keyboard)
            .await
    }

    async fn send_telegram_message_to_user(
        &self,
        user_id: UserId,
        text: String,
        keyboard: Option<serde_json::Value>,
    ) -> Result<(), NotificationError> {
        // Fan out push first (cheap, non-blocking), then send the
        // Telegram message. We do not wait on push results.
        self.fanout_push(user_id, text.clone()).await;
        self.telegram
            .send_telegram_message_to_user(user_id, text, keyboard)
            .await
    }

    async fn answer_callback_query(
        &self,
        callback_query_id: String,
        text: Option<String>,
    ) -> Result<(), NotificationError> {
        self.telegram
            .answer_callback_query(callback_query_id, text)
            .await
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

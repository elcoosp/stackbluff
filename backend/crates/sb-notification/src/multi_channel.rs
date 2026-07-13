use async_trait::async_trait;
use sb_contracts::notification_api::{NotificationError, NotificationService, ClubNotifier};
use sb_contracts::notification::NotificationEvent;
use sb_db_repos::push_subscription_repo::PushSubscriptionRepo;
use sb_shared_types::{errors::AppError, RequestContext, UserId, ClubId};
use std::sync::Arc;
use crate::web_push::{WebPushSender, SendOutcome};
use serde::Serialize;

#[derive(Serialize)]
struct PushPayload {
    title: String,
    body: String,
    url: String,
}

impl PushPayload {
    fn from_event(event: &NotificationEvent) -> Self {
        match event {
            NotificationEvent::TournamentReminder { tournament_id, name, starts_at } => Self {
                title: "Tournament Reminder".to_string(),
                body: format!("{} starts at {}", name, starts_at),
                url: format!("/tournaments/{}", tournament_id),
            },
            NotificationEvent::TournamentStarting { tournament_id } => Self {
                title: "Tournament Starting".to_string(),
                body: "Your tournament is starting now!".to_string(),
                url: format!("/tournaments/{}", tournament_id),
            },
            NotificationEvent::TournamentResult { tournament_id, position, prize } => Self {
                title: "Tournament Result".to_string(),
                body: format!("You finished #{} and won {} chips!", position, prize),
                url: format!("/tournaments/{}", tournament_id),
            },
            NotificationEvent::ClubReminder { club_id, message } => Self {
                title: "Club Reminder".to_string(),
                body: message.clone(),
                url: format!("/clubs/{}", club_id),
            },
            NotificationEvent::FriendInvite { from_user_id } => Self {
                title: "Friend Invite".to_string(),
                body: format!("You have a friend invite from {}", from_user_id),
                url: "/friends".to_string(),
            },
            NotificationEvent::ReplayCardReady { hand_id } => Self {
                title: "Replay Card Ready".to_string(),
                body: "Your replay card is ready to view!".to_string(),
                url: format!("/replays/{}", hand_id),
            },
            NotificationEvent::SeasonCardReady { season_id } => Self {
                title: "Season Card Ready".to_string(),
                body: format!("Your season {} card is ready!", season_id),
                url: "/profile".to_string(),
            },
        }
    }
}

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

        let payload = serde_json::to_string(&PushPayload::from_event(&event))
            .unwrap_or_else(|_| "{}".to_string());

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

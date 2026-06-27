use reqwest::Client;
use sb_contracts::notification::NotificationEvent;
use sb_shared_types::{errors::AppError, ids::UserId};

#[allow(dead_code)]
pub struct TelegramSender {
    bot_token: String,
    http_client: Client,
}

impl TelegramSender {
    pub fn new(bot_token: String) -> Self {
        Self {
            bot_token,
            http_client: Client::new(),
        }
    }

    pub async fn send(&self, _user_id: UserId, event: &NotificationEvent) -> Result<(), AppError> {
        let text = match event {
            NotificationEvent::TournamentReminder {
                tournament_name,
                start_time,
                deep_link,
            } => format!(
                "🏟️ Tournament '{}' starts at {}. Join: {}",
                tournament_name, start_time, deep_link
            ),
            NotificationEvent::StreakAlert { streak_count } => {
                format!("🔥 You're on a {}-day streak!", streak_count)
            }
            NotificationEvent::ReferralBonus {
                from_user_id,
                amount,
            } => format!("💰 {} sent you {} chips", from_user_id, amount),
            NotificationEvent::MissionComplete { mission_name } => {
                format!("✅ Mission '{}' completed!", mission_name)
            }
        };
        tracing::info!(?text, "Telegram send placeholder");
        Ok(())
    }
}

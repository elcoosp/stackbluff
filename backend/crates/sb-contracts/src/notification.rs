use sb_shared_types::chips::ChipAmount;
use sb_shared_types::errors::AppError;
use sb_shared_types::ids::UserId;
use sb_shared_types::request_context::RequestContext;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub enum NotificationEvent {
    TournamentReminder {
        tournament_name: String,
        start_time: String,
        deep_link: String,
    },
    StreakAlert {
        streak_count: u32,
    },
    ReferralBonus {
        from_user_id: UserId,
        amount: ChipAmount,
    },
    MissionComplete {
        mission_name: String,
    },
}

#[async_trait::async_trait]
pub trait NotificationService {
    async fn send(
        &self,
        ctx: &RequestContext,
        user_id: UserId,
        event: NotificationEvent,
    ) -> Result<(), AppError>;
}

use async_trait::async_trait;
use sb_shared_types::{RequestContext, UserId, errors::AppError};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", content = "data")]
pub enum NotificationEvent {
    TournamentReminder {
        tournament_id: String,
        name: String,
        starts_at: String,
    },
    TournamentStarting {
        tournament_id: String,
    },
    TournamentResult {
        tournament_id: String,
        position: u32,
        prize: i64,
    },
    ClubReminder {
        club_id: String,
        message: String,
    },
    FriendInvite {
        from_user_id: String,
    },
    ReplayCardReady {
        hand_id: String,
    },
    SeasonCardReady {
        season_id: i32,
    },
}

#[async_trait]
pub trait NotificationService: Send + Sync {
    async fn send(
        &self,
        ctx: &RequestContext,
        user_id: UserId,
        event: NotificationEvent,
    ) -> Result<(), AppError>;
}

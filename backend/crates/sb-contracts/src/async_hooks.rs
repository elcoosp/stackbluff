use crate::service_api::ClubProSettings;
use sb_shared_types::game_types::HandResult;
use async_trait::async_trait;
use sb_shared_types::{TableId, UserId};
use sb_shared_types::ids::ClubId;
use sb_shared_types::errors::AppError;

#[async_trait]
pub trait ReplayCardObserver: Send + Sync {
    async fn on_significant_hand(
        &self,
        hand_result: &HandResult,
        winner_id: UserId,
        table_id: TableId,
    );
}

#[async_trait]
pub trait HandCountObserver: Send + Sync {
    async fn on_hand_completed(&self, user_id: UserId);
}

#[async_trait::async_trait]
pub trait ConnectionBroker: Send + Sync {
    async fn broadcast_club_theme_updated(
        &self, club_id: ClubId, settings: ClubProSettings,
    ) -> Result<(), AppError>;
}

#[derive(Clone, Debug)]
pub struct BadgeUnlockedEvent {
    pub user_id: UserId,
    pub badge_type: String,
    pub awarded_at: chrono::DateTime<chrono::Utc>,
}

#[async_trait::async_trait]
pub trait BadgeEventNotifier: Send + Sync {
    async fn notify_badge_unlocked(&self, event: BadgeUnlockedEvent) -> Result<(), crate::persistence_error::PersistenceError>;
}

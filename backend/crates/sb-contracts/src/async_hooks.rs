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

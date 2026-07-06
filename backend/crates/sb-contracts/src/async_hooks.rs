use crate::service_api::HandResult;
use async_trait::async_trait;
use sb_shared_types::{TableId, UserId};

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

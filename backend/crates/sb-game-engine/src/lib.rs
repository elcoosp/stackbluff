pub mod analytics;
pub mod deck;
pub mod evaluate;
pub mod game_state;
pub mod hand_rank;
pub mod pot;

pub use deck::Deck;
pub use evaluate::compare_hands;
pub use game_state::{ActionError, GameState, HandId, Winner};
pub use hand_rank::HandRank;

use async_trait::async_trait;
use sb_contracts::service_api::HandResult;
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

pub struct GameEngine {
    replay_observers: Vec<std::sync::Arc<dyn ReplayCardObserver>>,
    hand_count_observers: Vec<std::sync::Arc<dyn HandCountObserver>>,
}

impl GameEngine {
    pub fn new() -> Self {
        Self {
            replay_observers: vec![],
            hand_count_observers: vec![],
        }
    }
    pub fn add_replay_observer(&mut self, observer: std::sync::Arc<dyn ReplayCardObserver>) {
        self.replay_observers.push(observer);
    }
    pub fn add_hand_count_observer(&mut self, observer: std::sync::Arc<dyn HandCountObserver>) {
        self.hand_count_observers.push(observer);
    }
    pub async fn notify_replay_observers(
        &self,
        hand_result: &HandResult,
        winner_id: UserId,
        table_id: TableId,
    ) {
        for observer in &self.replay_observers {
            if hand_result.is_significant() {
                observer
                    .on_significant_hand(hand_result, winner_id, table_id)
                    .await;
            }
        }
    }
    pub async fn notify_hand_count_observers(&self, user_id: UserId) {
        for observer in &self.hand_count_observers {
            observer.on_hand_completed(user_id).await;
        }
    }
}

impl Default for GameEngine {
    fn default() -> Self {
        Self::new()
    }
}

//! Pure poker game engine – deterministic, stateless, production-ready.
pub mod deck;
pub mod evaluate;
pub mod game_state;
pub mod hand_rank;
pub mod pot;

pub use deck::Deck;
pub use evaluate::compare_hands;
pub use game_state::{ActionError, GameState, HandId, Winner};
pub use hand_rank::HandRank;

// Viral hook: call this after hand resolution
pub async fn on_hand_complete(viral_service: &(dyn ViralService + Send + Sync), hand_result: &HandResult, winner_id: UserId, table_id: TableId) {
    if hand_result.is_significant() {
        let _ = viral_service.generate_replay_card(hand_result, winner_id, table_id).await;
    }
}

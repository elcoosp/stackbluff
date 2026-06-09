//! Pure poker game engine – deterministic, stateless.
//! Provides deck, hand evaluation, and game state transitions.

pub mod deck;
pub mod evaluate;
pub mod game_state;
pub mod hand_rank;

pub use deck::Deck;
pub use evaluate::compare_hands;
pub use game_state::{ActionError, GameState, HandId, Winner};
pub use hand_rank::HandRank;

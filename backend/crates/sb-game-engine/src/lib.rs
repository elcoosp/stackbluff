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

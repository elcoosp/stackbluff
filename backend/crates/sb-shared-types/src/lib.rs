pub mod cards;
pub mod chips;
pub mod errors;
pub mod game_types;
pub mod ids;
pub mod logging;
pub mod request_context;

// Re-export commonly used types
pub use cards::{Card, HandRank, Rank, Suit};
pub use chips::ChipAmount;
pub use errors::AppError;
pub use game_types::{ActionType, GameVariant, StakeLevel, TableConfig};
pub use ids::{ClubId, PlayerId, TableId, UserId};
pub use request_context::RequestContext;
impl TableId { pub fn new() -> Self { Self(Uuid::new_v4()) } }
impl TableId { pub fn new() -> Self { Self(Uuid::new_v4()) } }

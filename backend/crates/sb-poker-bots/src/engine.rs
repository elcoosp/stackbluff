//! BotEngine: Pure decision logic, zero I/O, RNG injected.

use rand::{Rng, RngExt};
use sb_shared_types::{ActionType, Card, ChipAmount};

pub struct Decision {
    pub action_type: ActionType,
    pub amount: Option<ChipAmount>,
    pub confidence: f32,
}

pub struct BotProfile {
    pub aggression: f32,
    pub bluff_frequency: f32,
}

pub struct BotViewState {
    pub street: String,
    pub pot_odds: f32,
    pub to_call: ChipAmount,
    pub min_raise: ChipAmount,
    pub can_check: bool,
    pub is_tilted: bool,
}

pub fn decide(
    rng: &mut impl Rng,
    profile: &BotProfile,
    state: &BotViewState,
    _hole_cards: &[Card],
    fast_equity: f32,
) -> Decision {
    let effective_equity = if state.is_tilted { fast_equity * 1.2 } else { fast_equity };

    let action_type = if effective_equity > 0.7 {
        // Strong hand
        if rng.random_bool(profile.aggression as f64) {
            ActionType::Raise
        } else {
            ActionType::Call
        }
    } else if effective_equity > state.pot_odds {
        // Call if equity > pot odds
        ActionType::Call
    } else if state.can_check {
        ActionType::Check
    } else {
        // Bluff occasionally
        if rng.random_bool(profile.bluff_frequency as f64) {
            ActionType::Raise
        } else {
            ActionType::Fold
        }
    };

    let amount = if action_type == ActionType::Raise {
        Some(state.min_raise)
    } else {
        None
    };

    Decision {
        action_type,
        amount,
        confidence: effective_equity,
    }
}

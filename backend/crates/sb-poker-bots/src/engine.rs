//! BotEngine: Pure decision logic, zero I/O, RNG injected.

use rand::{Rng, RngExt};
use sb_shared_types::{ActionType, Card, ChipAmount};

pub struct Decision {
    pub action_type: ActionType,
    pub amount: Option<ChipAmount>,
    pub confidence: f32,
}

#[derive(Debug, Clone)]
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

#[cfg(test)]
mod tests {
    use super::*;
    use rand::rngs::StdRng;
    use rand::SeedableRng;
    use sb_shared_types::{Card, ChipAmount, Rank, Suit};

    fn state(can_check: bool, pot_odds: f32) -> BotViewState {
        BotViewState {
            street: "flop".to_string(),
            pot_odds,
            to_call: ChipAmount::new(0).unwrap(),
            min_raise: ChipAmount::new(10).unwrap(),
            can_check,
            is_tilted: false,
        }
    }

    #[test]
    fn test_strong_hand_raises_or_calls() {
        let mut rng = StdRng::from_rng(&mut rand::rng());
        let profile = BotProfile { aggression: 1.0, bluff_frequency: 0.0 };
        let st = state(false, 0.3);

        let mut actions = Vec::new();
        for _ in 0..10 {
            let dec = decide(&mut rng, &profile, &st, &[], 0.9);
            actions.push(dec.action_type);
        }
        assert!(actions.iter().all(|a| *a == ActionType::Raise));
    }

    #[test]
    fn test_weak_hand_folds() {
        let mut rng = StdRng::from_rng(&mut rand::rng());
        let profile = BotProfile { aggression: 0.0, bluff_frequency: 0.0 };
        let st = state(false, 0.3);

        let dec = decide(&mut rng, &profile, &st, &[], 0.1);
        assert_eq!(dec.action_type, ActionType::Fold);
    }

    #[test]
    fn test_weak_hand_checks_if_possible() {
        let mut rng = StdRng::from_rng(&mut rand::rng());
        let profile = BotProfile { aggression: 0.0, bluff_frequency: 0.0 };
        let st = state(true, 0.3);

        let dec = decide(&mut rng, &profile, &st, &[], 0.1);
        assert_eq!(dec.action_type, ActionType::Check);
    }
}

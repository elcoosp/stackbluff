//! FastHandEvaluator: Heuristic local equity proxy.
//!
//! This module provides a deterministic, low-allocation evaluator for bot decisions.
//! It avoids Monte Carlo simulations and uses the Rule of 2 and 4 for draws.

use sb_shared_types::{Card, Rank, Suit};

/// Calculates a fast proxy for equity (0.0 to 1.0).
pub fn fast_equity(hole_cards: &[Card], community_cards: &[Card]) -> f32 {
    if community_cards.is_empty() {
        return preflop_equity(hole_cards);
    }

    let mut all_cards = [Card { suit: Suit::Clubs, rank: Rank::Two }; 7];
    all_cards[0] = hole_cards[0];
    all_cards[1] = hole_cards[1];
    for (i, c) in community_cards.iter().enumerate() {
        all_cards[2 + i] = *c;
    }
    let num_cards = 2 + community_cards.len();

    let strength = evaluate_made_hand_strength(&all_cards[..num_cards]);

    if strength >= 0.45 {
        // Made hand (One Pair or better)
        apply_board_texture_factor(strength, &all_cards[2..num_cards])
    } else {
        // Drawing hand (High Card)
        calculate_draw_equity(&all_cards[..num_cards], community_cards.len())
    }
}

fn preflop_equity(hole_cards: &[Card]) -> f32 {
    let c1 = hole_cards[0];
    let c2 = hole_cards[1];
    let r1 = rank_value(c1.rank);
    let r2 = rank_value(c2.rank);
    let suited = c1.suit == c2.suit;

    let (high, low) = if r1 > r2 { (r1, r2) } else { (r2, r1) };

    if r1 == r2 {
        // Pocket pair
        match high {
            14 => 0.85, // AA
            13 => 0.80, // KK
            12 => 0.75, // QQ
            11 => 0.70, // JJ
            10 => 0.65, // TT
            9 => 0.60,  // 99
            8 => 0.55,  // 88
            7 => 0.50,  // 77
            _ => 0.45,  // 22-66
        }
    } else {
        // High card
        let base = match high {
            14 => 0.50, // Ace high
            13 => 0.45,
            12 => 0.40,
            _ => 0.35,
        };
        let gap_penalty = (high - low - 1) as f32 * 0.05;
        let suited_bonus = if suited { 0.10 } else { 0.0 };
        let mut equity = base - gap_penalty + suited_bonus;
        if equity < 0.10 { equity = 0.10; }
        equity
    }
}

fn evaluate_made_hand_strength(cards: &[Card]) -> f32 {
    let mut rank_counts = [0u8; 15];
    for card in cards {
        rank_counts[rank_value(card.rank) as usize] += 1;
    }

    let mut counts = [0u8; 5];
    for &c in rank_counts.iter() {
        if c > 0 {
            counts[c as usize] += 1;
        }
    }

    let mut suit_counts = [0u8; 4];
    for card in cards {
        suit_counts[suit_index(card.suit) as usize] += 1;
    }
    let is_flush = suit_counts.iter().any(|&c| c >= 5);

    let is_straight = check_straight(&rank_counts);

    if is_straight && is_flush { return 1.0; }
    if counts[4] >= 1 { return 0.95; } // Four of a kind
    if counts[3] >= 1 && counts[2] >= 1 { return 0.90; } // Full house
    if is_flush { return 0.85; }
    if is_straight { return 0.80; }
    if counts[3] >= 1 { return 0.65; } // Three of a kind
    if counts[2] >= 2 { return 0.55; } // Two pair
    if counts[2] == 1 { return 0.45; } // One pair

    0.20 // High card
}

fn apply_board_texture_factor(strength: f32, board: &[Card]) -> f32 {
    let mut suit_counts = [0u8; 4];
    for card in board {
        suit_counts[suit_index(card.suit) as usize] += 1;
    }
    let monotone = suit_counts.iter().any(|&c| c >= 3) && board.len() == 3;

    if strength < 0.5 && monotone {
        strength * 0.4
    } else {
        strength
    }
}

fn calculate_draw_equity(cards: &[Card], community_len: usize) -> f32 {
    let outs = count_outs(cards);
    let multiplier = if community_len == 3 { 4.0 } else { 2.0 };
    (outs as f32 * multiplier) / 100.0
}

fn count_outs(cards: &[Card]) -> u8 {
    let mut suit_counts = [0u8; 4];
    for card in cards {
        suit_counts[suit_index(card.suit) as usize] += 1;
    }
    let mut outs = 0;
    if suit_counts.iter().any(|&c| c == 4) {
        outs += 9; // Flush draw
    }

    let mut ranks = [false; 15];
    for card in cards {
        ranks[rank_value(card.rank) as usize] = true;
    }

    // Check for OESD (4 consecutive)
    for i in 2..=10 {
        if ranks[i] && ranks[i+1] && ranks[i+2] && ranks[i+3] {
            outs += 8; // OESD
            break;
        }
    }
    outs
}

fn rank_value(rank: Rank) -> u8 {
    match rank {
        Rank::Two => 2, Rank::Three => 3, Rank::Four => 4, Rank::Five => 5,
        Rank::Six => 6, Rank::Seven => 7, Rank::Eight => 8, Rank::Nine => 9,
        Rank::Ten => 10, Rank::Jack => 11, Rank::Queen => 12, Rank::King => 13,
        Rank::Ace => 14,
    }
}

fn suit_index(suit: Suit) -> usize {
    match suit {
        Suit::Clubs => 0, Suit::Diamonds => 1, Suit::Hearts => 2, Suit::Spades => 3,
    }
}

fn check_straight(rank_counts: &[u8]) -> bool {
    let mut consecutive = 0;
    for i in 2..=14 {
        if rank_counts[i] > 0 {
            consecutive += 1;
            if consecutive >= 5 { return true; }
        } else {
            consecutive = 0;
        }
    }
    // Ace-low straight
    if rank_counts[14] > 0 && rank_counts[2] > 0 && rank_counts[3] > 0 && rank_counts[4] > 0 && rank_counts[5] > 0 {
        return true;
    }
    false
}

#[cfg(test)]
mod tests {
    use super::*;
    use sb_shared_types::{Card, Rank, Suit};

    fn c(suit: Suit, rank: Rank) -> Card {
        Card { suit, rank }
    }

    #[test]
    fn test_preflop_aces() {
        let hole = [c(Suit::Hearts, Rank::Ace), c(Suit::Spades, Rank::Ace)];
        let comm = [];
        let equity = fast_equity(&hole, &comm);
        assert!(equity > 0.8 && equity <= 1.0);
    }

    #[test]
    fn test_preflop_seven_deuce() {
        let hole = [c(Suit::Hearts, Rank::Two), c(Suit::Clubs, Rank::Seven)];
        let comm = [];
        let equity = fast_equity(&hole, &comm);
        assert!(equity < 0.4);
    }

    #[test]
    fn test_postflop_flush_draw() {
        let hole = [c(Suit::Hearts, Rank::Ace), c(Suit::Hearts, Rank::King)];
        let comm = [
            c(Suit::Hearts, Rank::Two),
            c(Suit::Hearts, Rank::Five),
            c(Suit::Clubs, Rank::Nine),
        ];
        let equity = fast_equity(&hole, &comm);
        // Rule of 2 and 4: 9 outs * 4 = 36%
        assert!((equity - 0.36).abs() < 0.01);
    }

    #[test]
    fn test_postflop_made_hand() {
        let hole = [c(Suit::Hearts, Rank::Ace), c(Suit::Spades, Rank::Ace)];
        let comm = [
            c(Suit::Clubs, Rank::Ace),
            c(Suit::Diamonds, Rank::King),
            c(Suit::Hearts, Rank::King),
        ];
        let equity = fast_equity(&hole, &comm);
        // Full house, should be high
        assert!(equity >= 0.9);
    }
}

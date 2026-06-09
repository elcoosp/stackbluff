//! 7‑card hand evaluation – returns comparable hand strength with correct kickers.

use crate::hand_rank::HandRank;
use sb_shared_types::{Card, Suit};
use std::cmp::Ordering;
use std::collections::{HashMap, HashSet};

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------
fn rank_value(rank: &sb_shared_types::Rank) -> u8 {
    match rank {
        sb_shared_types::Rank::Two => 2,
        sb_shared_types::Rank::Three => 3,
        sb_shared_types::Rank::Four => 4,
        sb_shared_types::Rank::Five => 5,
        sb_shared_types::Rank::Six => 6,
        sb_shared_types::Rank::Seven => 7,
        sb_shared_types::Rank::Eight => 8,
        sb_shared_types::Rank::Nine => 9,
        sb_shared_types::Rank::Ten => 10,
        sb_shared_types::Rank::Jack => 11,
        sb_shared_types::Rank::Queen => 12,
        sb_shared_types::Rank::King => 13,
        sb_shared_types::Rank::Ace => 14,
    }
}

/// Generate all combinations of size k from a slice (simple recursion).
fn combinations<T: Clone>(items: &[T], k: usize) -> Vec<Vec<T>> {
    if k == 0 {
        return vec![vec![]];
    }
    let mut result = Vec::new();
    for i in 0..items.len() {
        let rest = &items[i + 1..];
        for mut comb in combinations(rest, k - 1) {
            comb.insert(0, items[i].clone());
            result.push(comb);
        }
    }
    result
}

// -----------------------------------------------------------------------------
// HandStrength: comparable representation
// -----------------------------------------------------------------------------
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct HandStrength {
    pub rank: HandRank,
    pub kickers: Vec<u8>, // highest to lowest, with duplicates for multiples
}

impl PartialOrd for HandStrength {
    fn partial_cmp(&self, other: &Self) -> Option<Ordering> {
        Some(self.cmp(other))
    }
}

impl Ord for HandStrength {
    fn cmp(&self, other: &Self) -> Ordering {
        self.rank
            .cmp(&other.rank)
            .then_with(|| self.kickers.cmp(&other.kickers))
    }
}

// -----------------------------------------------------------------------------
// Core evaluation functions
// -----------------------------------------------------------------------------
pub fn evaluate_hand_strength(hole_cards: &[Card; 2], community: &[Card; 5]) -> HandStrength {
    let mut all_cards = Vec::with_capacity(7);
    all_cards.extend_from_slice(hole_cards);
    all_cards.extend_from_slice(community);

    let indices: Vec<usize> = (0..7).collect();
    let mut best_strength = HandStrength {
        rank: HandRank::HighCard,
        kickers: vec![],
    };
    for comb in combinations(&indices, 5) {
        let hand: Vec<Card> = comb.iter().map(|&i| all_cards[i]).collect();
        let strength = evaluate_5_card_strength(&hand);
        if strength > best_strength {
            best_strength = strength;
        }
    }
    best_strength
}

pub fn evaluate_hand(hole_cards: &[Card; 2], community: &[Card; 5]) -> HandRank {
    evaluate_hand_strength(hole_cards, community).rank
}

/// Evaluate a 5‑card hand and return its full strength.
fn evaluate_5_card_strength(cards: &[Card]) -> HandStrength {
    let ranks: Vec<u8> = cards.iter().map(|c| rank_value(&c.rank)).collect();
    let suits: Vec<Suit> = cards.iter().map(|c| c.suit).collect();
    let is_flush = suits.iter().all(|&s| s == suits[0]);

    // Count occurrences of each rank
    let mut rank_counts = HashMap::new();
    for &r in &ranks {
        *rank_counts.entry(r).or_insert(0) += 1;
    }
    let mut count_rank_pairs: Vec<(u8, u8)> = rank_counts.into_iter().collect();
    // Sort by count descending, then rank descending
    count_rank_pairs.sort_by(|a, b| b.1.cmp(&a.1).then_with(|| b.0.cmp(&a.0)));

    // Detect straight
    let is_straight = {
        let unique: HashSet<u8> = ranks.iter().copied().collect();
        if unique.len() < 5 {
            false
        } else {
            let mut sorted: Vec<u8> = unique.into_iter().collect();
            sorted.sort_unstable();
            let straight = (0..4).all(|i| sorted[i + 1] == sorted[i] + 1);
            if straight {
                true
            } else {
                // Ace-low straight: 2,3,4,5,14
                sorted == vec![2, 3, 4, 5, 14]
            }
        }
    };

    let rank = if is_flush && is_straight {
        HandRank::StraightFlush
    } else if is_flush {
        HandRank::Flush
    } else if is_straight {
        HandRank::Straight
    } else {
        match count_rank_pairs[0].1 {
            4 => HandRank::FourOfAKind,
            3 => {
                if count_rank_pairs.len() > 1 && count_rank_pairs[1].1 == 2 {
                    HandRank::FullHouse
                } else {
                    HandRank::ThreeOfAKind
                }
            }
            2 => {
                if count_rank_pairs.len() > 1 && count_rank_pairs[1].1 == 2 {
                    HandRank::TwoPair
                } else {
                    HandRank::OnePair
                }
            }
            _ => HandRank::HighCard,
        }
    };

    let kickers = build_kickers(&count_rank_pairs, &ranks, rank);
    HandStrength { rank, kickers }
}

/// Build the kicker vector for a hand (after rank is known).
fn build_kickers(count_pairs: &[(u8, u8)], ranks: &[u8], rank: HandRank) -> Vec<u8> {
    match rank {
        HandRank::StraightFlush | HandRank::Straight => {
            let unique: HashSet<u8> = ranks.iter().copied().collect();
            let mut sorted: Vec<u8> = unique.into_iter().collect();
            sorted.sort_unstable();
            if sorted == vec![2, 3, 4, 5, 14] {
                vec![5, 4, 3, 2, 14]
            } else {
                sorted.into_iter().rev().collect()
            }
        }
        HandRank::Flush => {
            let mut flush_ranks = ranks.to_vec();
            flush_ranks.sort_unstable_by(|a, b| b.cmp(a));
            flush_ranks
        }
        HandRank::FourOfAKind => {
            let four = count_pairs[0].0;
            let kicker = count_pairs[1].0;
            vec![four, four, four, four, kicker]
        }
        HandRank::FullHouse => {
            let three = count_pairs[0].0;
            let two = count_pairs[1].0;
            vec![three, three, three, two, two]
        }
        HandRank::ThreeOfAKind => {
            let three_rank = count_pairs[0].0;
            let mut kickers = vec![three_rank, three_rank, three_rank];
            let mut other_ranks: Vec<u8> = count_pairs.iter().skip(1).map(|(r, _)| *r).collect();
            other_ranks.sort_unstable_by(|a, b| b.cmp(a));
            kickers.extend(other_ranks);
            kickers.truncate(5);
            kickers
        }
        HandRank::TwoPair => {
            let high = count_pairs[0].0;
            let low = count_pairs[1].0;
            let kicker = count_pairs[2].0;
            vec![high, high, low, low, kicker]
        }
        HandRank::OnePair => {
            let pair_rank = count_pairs[0].0;
            let mut other_ranks: Vec<u8> = count_pairs.iter().skip(1).map(|(r, _)| *r).collect();
            other_ranks.sort_unstable_by(|a, b| b.cmp(a));
            let mut kickers = vec![pair_rank, pair_rank];
            kickers.extend(other_ranks);
            kickers.truncate(5);
            kickers
        }
        HandRank::HighCard => {
            let mut high = ranks.to_vec();
            high.sort_unstable_by(|a, b| b.cmp(a));
            high
        }
    }
}

// -----------------------------------------------------------------------------
// Public comparison function
// -----------------------------------------------------------------------------
pub fn compare_hands(
    hole1: &[Card; 2],
    community1: &[Card; 5],
    hole2: &[Card; 2],
    community2: &[Card; 5],
) -> Ordering {
    let s1 = evaluate_hand_strength(hole1, community1);
    let s2 = evaluate_hand_strength(hole2, community2);
    s1.cmp(&s2)
}

// -----------------------------------------------------------------------------
// Tests
// -----------------------------------------------------------------------------
#[cfg(test)]
mod tests {
    use super::*;
    use sb_shared_types::{Rank, Suit};
    fn card(suit: Suit, rank: Rank) -> Card {
        Card { suit, rank }
    }

    #[test]
    fn test_high_card() {
        let hole = [
            card(Suit::Hearts, Rank::Two),
            card(Suit::Clubs, Rank::Three),
        ];
        let community = [
            card(Suit::Diamonds, Rank::Five),
            card(Suit::Spades, Rank::Seven),
            card(Suit::Hearts, Rank::Nine),
            card(Suit::Clubs, Rank::Jack),
            card(Suit::Diamonds, Rank::King),
        ];
        let strength = evaluate_hand_strength(&hole, &community);
        assert_eq!(strength.rank, HandRank::HighCard);
        assert_eq!(strength.kickers, vec![13, 11, 9, 7, 5]);
    }

    #[test]
    fn test_one_pair_kickers() {
        let hole = [
            card(Suit::Hearts, Rank::Five),
            card(Suit::Clubs, Rank::Five),
        ];
        let community = [
            card(Suit::Diamonds, Rank::Two),
            card(Suit::Spades, Rank::Three),
            card(Suit::Hearts, Rank::Seven),
            card(Suit::Clubs, Rank::Eight),
            card(Suit::Diamonds, Rank::King),
        ];
        let strength = evaluate_hand_strength(&hole, &community);
        assert_eq!(strength.rank, HandRank::OnePair);
        assert_eq!(strength.kickers, vec![5, 5, 13, 8, 7]);
    }

    #[test]
    fn test_three_of_a_kind_kickers() {
        let hole = [
            card(Suit::Hearts, Rank::Five),
            card(Suit::Clubs, Rank::Five),
        ];
        let community = [
            card(Suit::Diamonds, Rank::Five),
            card(Suit::Spades, Rank::King),
            card(Suit::Hearts, Rank::Queen),
            card(Suit::Clubs, Rank::Two),
            card(Suit::Diamonds, Rank::Three),
        ];
        let strength = evaluate_hand_strength(&hole, &community);
        assert_eq!(strength.rank, HandRank::ThreeOfAKind);
        assert_eq!(strength.kickers, vec![5, 5, 5, 13, 12]);
    }

    #[test]
    fn test_straight_flush() {
        let hole = [
            card(Suit::Hearts, Rank::Nine),
            card(Suit::Hearts, Rank::King),
        ];
        let community = [
            card(Suit::Hearts, Rank::Ten),
            card(Suit::Hearts, Rank::Jack),
            card(Suit::Hearts, Rank::Queen),
            card(Suit::Clubs, Rank::Two),
            card(Suit::Diamonds, Rank::Three),
        ];
        let strength = evaluate_hand_strength(&hole, &community);
        assert_eq!(strength.rank, HandRank::StraightFlush);
        assert_eq!(strength.kickers, vec![13, 12, 11, 10, 9]);
    }

    #[test]
    fn test_ace_low_straight() {
        let hole = [card(Suit::Hearts, Rank::Ace), card(Suit::Clubs, Rank::Two)];
        let community = [
            card(Suit::Diamonds, Rank::Three),
            card(Suit::Spades, Rank::Four),
            card(Suit::Hearts, Rank::Five),
            card(Suit::Clubs, Rank::Nine),
            card(Suit::Diamonds, Rank::King),
        ];
        let strength = evaluate_hand_strength(&hole, &community);
        assert_eq!(strength.rank, HandRank::Straight);
        assert_eq!(strength.kickers, vec![5, 4, 3, 2, 14]);
    }

    #[test]
    fn test_flush_kickers() {
        let hole = [
            card(Suit::Hearts, Rank::Two),
            card(Suit::Hearts, Rank::Seven),
        ];
        let community = [
            card(Suit::Hearts, Rank::Five),
            card(Suit::Hearts, Rank::Nine),
            card(Suit::Hearts, Rank::King),
            card(Suit::Clubs, Rank::Three),
            card(Suit::Diamonds, Rank::Four),
        ];
        let strength = evaluate_hand_strength(&hole, &community);
        assert_eq!(strength.rank, HandRank::Flush);
        assert_eq!(strength.kickers, vec![13, 9, 7, 5, 2]);
    }

    #[test]
    fn test_two_pair_tie_breaker() {
        let hole1 = [card(Suit::Hearts, Rank::Ace), card(Suit::Clubs, Rank::Ace)];
        let community1 = [
            card(Suit::Diamonds, Rank::King),
            card(Suit::Spades, Rank::King),
            card(Suit::Hearts, Rank::Queen),
            card(Suit::Clubs, Rank::Two),
            card(Suit::Diamonds, Rank::Three),
        ];
        let hole2 = [card(Suit::Hearts, Rank::Ace), card(Suit::Clubs, Rank::Ace)];
        let community2 = [
            card(Suit::Diamonds, Rank::King),
            card(Suit::Spades, Rank::King),
            card(Suit::Hearts, Rank::Jack),
            card(Suit::Clubs, Rank::Two),
            card(Suit::Diamonds, Rank::Three),
        ];
        assert_eq!(
            compare_hands(&hole1, &community1, &hole2, &community2),
            Ordering::Greater
        );
    }
}

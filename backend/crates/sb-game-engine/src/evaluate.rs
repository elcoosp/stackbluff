//! 7-card hand evaluation – returns comparable strength for ties.

use crate::hand_rank::HandRank;
use sb_shared_types::{Card, Suit};
use std::cmp::Ordering;
use std::collections::{HashMap, HashSet};

// Convert rank to numeric value
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

/// Represents the strength of a 7‑card hand: (HandRank, sorted kickers from the best 5‑card combo)
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct HandStrength {
    pub rank: HandRank,
    pub kickers: Vec<u8>, // highest to lowest
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

/// Evaluate a 7-card hand and return a comparable strength.
pub fn evaluate_hand_strength(hole_cards: &[Card; 2], community: &[Card; 5]) -> HandStrength {
    let mut all_cards = Vec::with_capacity(7);
    all_cards.extend_from_slice(hole_cards);
    all_cards.extend_from_slice(community);

    let mut best_strength = HandStrength {
        rank: HandRank::HighCard,
        kickers: vec![],
    };

    let indices: Vec<usize> = (0..7).collect();
    for comb in combinations(&indices, 5) {
        let hand: Vec<Card> = comb.iter().map(|&i| all_cards[i]).collect();
        let strength = evaluate_5_card_strength(&hand);
        if strength > best_strength {
            best_strength = strength;
        }
    }
    best_strength
}

/// Legacy function for simple rank evaluation (for compatibility)
pub fn evaluate_hand(hole_cards: &[Card; 2], community: &[Card; 5]) -> HandRank {
    evaluate_hand_strength(hole_cards, community).rank
}

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

fn evaluate_5_card_strength(cards: &[Card]) -> HandStrength {
    let ranks: Vec<u8> = cards.iter().map(|c| rank_value(&c.rank)).collect();
    let suits: Vec<Suit> = cards.iter().map(|c| c.suit).collect();
    let is_flush = suits.iter().all(|&s| s == suits[0]);

    let mut rank_counts: HashMap<u8, u8> = HashMap::new();
    for &r in &ranks {
        *rank_counts.entry(r).or_insert(0) += 1;
    }
    // Sort by count descending, then rank descending
    let mut count_rank_pairs: Vec<(u8, u8)> = rank_counts.into_iter().collect();
    count_rank_pairs.sort_by(|a, b| b.1.cmp(&a.1).then_with(|| b.0.cmp(&a.0)));

    // Determine hand rank
    let rank = evaluate_rank(&count_rank_pairs, is_flush, &ranks);
    // Build kickers: all ranks sorted descending, but for full house/four/three/two pair we need special handling
    let kickers = build_kickers(&count_rank_pairs, rank);
    HandStrength { rank, kickers }
}

fn evaluate_rank(count_pairs: &[(u8, u8)], is_flush: bool, ranks: &[u8]) -> HandRank {
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
                sorted == vec![2, 3, 4, 5, 14]
            }
        }
    };

    if is_flush && is_straight {
        HandRank::StraightFlush
    } else if is_flush {
        HandRank::Flush
    } else if is_straight {
        HandRank::Straight
    } else {
        match count_pairs[0].1 {
            4 => HandRank::FourOfAKind,
            3 => {
                if count_pairs.len() > 1 && count_pairs[1].1 == 2 {
                    HandRank::FullHouse
                } else {
                    HandRank::ThreeOfAKind
                }
            }
            2 => {
                if count_pairs.len() > 1 && count_pairs[1].1 == 2 {
                    HandRank::TwoPair
                } else {
                    HandRank::OnePair
                }
            }
            _ => HandRank::HighCard,
        }
    }
}

fn build_kickers(count_pairs: &[(u8, u8)], rank: HandRank) -> Vec<u8> {
    let mut kickers = Vec::new();
    match rank {
        HandRank::StraightFlush | HandRank::Straight | HandRank::Flush => {
            // Just the five ranks in descending order
            let mut all_ranks: Vec<u8> = count_pairs.iter().flat_map(|(r, _)| vec![*r; *r as usize]).collect();
            all_ranks.sort_unstable_by(|a, b| b.cmp(a));
            kickers = all_ranks.into_iter().take(5).collect();
        }
        HandRank::FourOfAKind => {
            let four_rank = count_pairs[0].0;
            let kicker = count_pairs[1].0;
            kickers = vec![four_rank, four_rank, four_rank, four_rank, kicker];
        }
        HandRank::FullHouse => {
            let three_rank = count_pairs[0].0;
            let pair_rank = count_pairs[1].0;
            kickers = vec![three_rank, three_rank, three_rank, pair_rank, pair_rank];
        }
        HandRank::ThreeOfAKind => {
            let three_rank = count_pairs[0].0;
            kickers.push(three_rank);
            kickers.push(three_rank);
            kickers.push(three_rank);
            for &(r, _) in count_pairs.iter().skip(1) {
                kickers.push(r);
            }
            kickers.sort_unstable_by(|a, b| b.cmp(a));
        }
        HandRank::TwoPair => {
            let high_pair = count_pairs[0].0;
            let low_pair = count_pairs[1].0;
            let kicker = count_pairs[2].0;
            kickers = vec![high_pair, high_pair, low_pair, low_pair, kicker];
        }
        HandRank::OnePair => {
            let pair_rank = count_pairs[0].0;
            kickers.push(pair_rank);
            kickers.push(pair_rank);
            for &(r, _) in count_pairs.iter().skip(1) {
                kickers.push(r);
            }
            kickers.sort_unstable_by(|a, b| b.cmp(a));
            kickers.truncate(5);
        }
        HandRank::HighCard => {
            let mut all_ranks: Vec<u8> = count_pairs.iter().map(|(r, _)| *r).collect();
            all_ranks.sort_unstable_by(|a, b| b.cmp(a));
            kickers = all_ranks;
        }
    }
    kickers
}

/// Compare two 7-card hands using the full strength.
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

#[cfg(test)]
mod tests {
    use super::*;
    use sb_shared_types::{Rank, Suit};
    fn card(suit: Suit, rank: Rank) -> Card {
        Card { suit, rank }
    }

    #[test]
    fn test_high_card() {
        let hole = [card(Suit::Hearts, Rank::Two), card(Suit::Clubs, Rank::Three)];
        let community = [
            card(Suit::Diamonds, Rank::Five),
            card(Suit::Spades, Rank::Seven),
            card(Suit::Hearts, Rank::Nine),
            card(Suit::Clubs, Rank::Jack),
            card(Suit::Diamonds, Rank::King),
        ];
        let strength = evaluate_hand_strength(&hole, &community);
        assert_eq!(strength.rank, HandRank::HighCard);
        assert_eq!(strength.kickers, vec![13, 11, 9, 7, 5]); // K,J,9,7,5
    }

    #[test]
    fn test_one_pair_kickers() {
        let hole = [card(Suit::Hearts, Rank::Five), card(Suit::Clubs, Rank::Five)];
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
    fn test_compare_hands_with_kickers() {
        // Hand1: pair of 5s with K,8,7 kickers
        let hole1 = [card(Suit::Hearts, Rank::Five), card(Suit::Clubs, Rank::Five)];
        let community1 = [
            card(Suit::Diamonds, Rank::Two),
            card(Suit::Spades, Rank::Three),
            card(Suit::Hearts, Rank::Seven),
            card(Suit::Clubs, Rank::Eight),
            card(Suit::Diamonds, Rank::King),
        ];
        // Hand2: pair of 5s with K,8,6 kickers (lower)
        let hole2 = [card(Suit::Hearts, Rank::Five), card(Suit::Clubs, Rank::Five)];
        let community2 = [
            card(Suit::Diamonds, Rank::Two),
            card(Suit::Spades, Rank::Three),
            card(Suit::Hearts, Rank::Six),
            card(Suit::Clubs, Rank::Eight),
            card(Suit::Diamonds, Rank::King),
        ];
        assert_eq!(compare_hands(&hole1, &community1, &hole2, &community2), Ordering::Greater);
    }
}

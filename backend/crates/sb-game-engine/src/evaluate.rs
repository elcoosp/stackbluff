//! 7-card hand evaluation.

use crate::hand_rank::HandRank;
use sb_shared_types::{Card, Rank, Suit};
use std::cmp::Ordering;
use std::collections::{HashMap, HashSet};

pub fn evaluate_hand(hole_cards: &[Card; 2], community: &[Card; 5]) -> HandRank {
    let mut all_cards = Vec::with_capacity(7);
    all_cards.extend_from_slice(hole_cards);
    all_cards.extend_from_slice(community);
    let mut best_rank = HandRank::HighCard;
    let indices: Vec<usize> = (0..7).collect();
    for comb in combinations(&indices, 5) {
        let hand: Vec<Card> = comb.iter().map(|&i| all_cards[i]).collect();
        let rank = evaluate_5_card_hand(&hand);
        if rank > best_rank {
            best_rank = rank;
        }
    }
    best_rank
}

fn combinations<T: Clone>(items: &[T], k: usize) -> Vec<Vec<T>> {
    if k == 0 {
        return vec![vec![]];
    }
    let mut result = Vec::new();
    for i in 0..items.len() {
        let rest = &items[i+1..];
        for mut comb in combinations(rest, k-1) {
            comb.insert(0, items[i].clone());
            result.push(comb);
        }
    }
    result
}

fn evaluate_5_card_hand(cards: &[Card]) -> HandRank {
    let ranks: Vec<u8> = cards.iter().map(|c| c.rank.value()).collect();
    let suits: Vec<Suit> = cards.iter().map(|c| c.suit).collect();
    let is_flush = suits.iter().all(|&s| s == suits[0]);
    let mut rank_counts: HashMap<u8, u8> = HashMap::new();
    for &r in &ranks {
        *rank_counts.entry(r).or_insert(0) += 1;
    }
    let mut counts: Vec<u8> = rank_counts.values().copied().collect();
    counts.sort_unstable_by(|a, b| b.cmp(a));

    let is_straight = {
        let unique: HashSet<u8> = ranks.iter().copied().collect();
        if unique.len() < 5 {
            false
        } else {
            let mut sorted: Vec<u8> = unique.into_iter().collect();
            sorted.sort_unstable();
            let straight = (0..4).all(|i| sorted[i+1] == sorted[i] + 1);
            if straight { true }
            else { sorted == vec![2,3,4,5,14] }
        }
    };

    match (is_flush, is_straight) {
        (true, true) => HandRank::StraightFlush,
        (true, false) => HandRank::Flush,
        (false, true) => HandRank::Straight,
        (false, false) => {
            if counts[0] == 4 { HandRank::FourOfAKind }
            else if counts[0] == 3 && counts[1] == 2 { HandRank::FullHouse }
            else if counts[0] == 3 { HandRank::ThreeOfAKind }
            else if counts[0] == 2 && counts[1] == 2 { HandRank::TwoPair }
            else if counts[0] == 2 { HandRank::OnePair }
            else { HandRank::HighCard }
        }
    }
}

pub fn compare_hands(
    hole1: &[Card; 2],
    community1: &[Card; 5],
    hole2: &[Card; 2],
    community2: &[Card; 5],
) -> Ordering {
    let rank1 = evaluate_hand(hole1, community1);
    let rank2 = evaluate_hand(hole2, community2);
    if rank1 != rank2 { rank1.cmp(&rank2) }
    else { best_5_card_hand(hole1, community1).cmp(&best_5_card_hand(hole2, community2)) }
}

fn best_5_card_hand(hole: &[Card; 2], community: &[Card; 5]) -> Vec<u8> {
    let mut all = Vec::with_capacity(7);
    all.extend_from_slice(hole);
    all.extend_from_slice(community);
    let indices: Vec<usize> = (0..7).collect();
    let mut best = vec![0;5];
    for comb in combinations(&indices, 5) {
        let mut ranks: Vec<u8> = comb.iter().map(|&i| all[i].rank.value()).collect();
        ranks.sort_unstable_by(|a,b| b.cmp(a));
        if ranks > best { best = ranks; }
    }
    best
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
        let hole = [card(Suit::Heart, Rank::Number(2)), card(Suit::Club, Rank::Number(3))];
        let community = [
            card(Suit::Diamond, Rank::Number(5)), card(Suit::Spade, Rank::Number(7)),
            card(Suit::Heart, Rank::Number(9)), card(Suit::Club, Rank::Jack),
            card(Suit::Diamond, Rank::King),
        ];
        assert_eq!(evaluate_hand(&hole, &community), HandRank::HighCard);
    }
    // other tests omitted for brevity but can be added similarly
}

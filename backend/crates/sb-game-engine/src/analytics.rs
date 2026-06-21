// backend/crates/sb-game-engine/src/analytics.rs
use crate::evaluate::evaluate_hand_strength;
use crate::hand_rank::HandRank;
use rand::seq::SliceRandom;
use sb_shared_types::{Card, Rank, Suit};

pub fn run_monte_carlo(hero_cards: &[Card; 2], community_cards: &[Card], iterations: u32) -> u8 {
    let mut wins = 0;
    let mut ties = 0;

    // Build remaining deck manually
    let mut remaining_deck: Vec<Card> = Vec::new();
    for suit in [Suit::Clubs, Suit::Diamonds, Suit::Hearts, Suit::Spades] {
        for rank in [
            Rank::Two,
            Rank::Three,
            Rank::Four,
            Rank::Five,
            Rank::Six,
            Rank::Seven,
            Rank::Eight,
            Rank::Nine,
            Rank::Ten,
            Rank::Jack,
            Rank::Queen,
            Rank::King,
            Rank::Ace,
        ] {
            let c = Card { suit, rank };
            if !hero_cards.contains(&c) && !community_cards.contains(&c) {
                remaining_deck.push(c);
            }
        }
    }

    let mut rng = rand::rng();

    for _ in 0..iterations {
        remaining_deck.shuffle(&mut rng);

        let opp_cards: [Card; 2] = [remaining_deck[0], remaining_deck[1]];
        let fill_count = 5 - community_cards.len();
        let fill_comm: Vec<Card> = remaining_deck[2..2 + fill_count].to_vec();

        let mut hero_comm = community_cards.to_vec();
        hero_comm.extend_from_slice(&fill_comm);
        let hero_comm_5: [Card; 5] = hero_comm[..5].try_into().unwrap();

        let mut opp_comm = community_cards.to_vec();
        opp_comm.extend_from_slice(&fill_comm);
        let opp_comm_5: [Card; 5] = opp_comm[..5].try_into().unwrap();

        let (hero_strength, _) = evaluate_hand_strength(hero_cards, &hero_comm_5);
        let (opp_strength, _) = evaluate_hand_strength(&opp_cards, &opp_comm_5);

        match hero_strength.cmp(&opp_strength) {
            std::cmp::Ordering::Greater => wins += 1,
            std::cmp::Ordering::Equal => ties += 1,
            _ => {}
        }
    }

    (((wins as f32) + (ties as f32) * 0.5) / iterations as f32 * 100.0) as u8
}

pub fn get_strength_score(rank: HandRank) -> u8 {
    match rank {
        HandRank::HighCard => 10,
        HandRank::OnePair => 25,
        HandRank::TwoPair => 45,
        HandRank::ThreeOfAKind => 60,
        HandRank::Straight => 70,
        HandRank::Flush => 80,
        HandRank::FullHouse => 88,
        HandRank::FourOfAKind => 95,
        HandRank::StraightFlush => 99,
    }
}

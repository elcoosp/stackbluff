//! Standard 52-card deck, shuffling with CSPRNG.

use rand::seq::SliceRandom;
use rand::RngCore;
use sb_shared_types::{Card, Suit, Rank};
use std::cmp::Ordering;

/// A standard 52-card deck.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Deck {
    cards: Vec<Card>,
}

impl Deck {
    /// Creates a new, unshuffled deck in order: Clubs, Diamonds, Hearts, Spades, Ace low to King high.
    pub fn new() -> Self {
        let mut cards = Vec::with_capacity(52);
        for &suit in &[Suit::Club, Suit::Diamond, Suit::Heart, Suit::Spade] {
            for rank in 2..=14 {
                let rank = match rank {
                    11 => Rank::Jack,
                    12 => Rank::Queen,
                    13 => Rank::King,
                    14 => Rank::Ace,
                    r => Rank::Number(r),
                };
                cards.push(Card::new(suit, rank));
            }
        }
        Deck { cards }
    }

    /// Shuffles the deck using `OsRng` (CSPRNG).
    pub fn shuffle(&mut self) {
        let mut rng = rand::rngs::OsRng;
        self.cards.shuffle(&mut rng);
    }

    /// Deals the top card, removing it from the deck.
    /// Returns `None` if the deck is empty.
    pub fn deal(&mut self) -> Option<Card> {
        self.cards.pop()
    }

    /// Returns the number of cards remaining.
    pub fn len(&self) -> usize {
        self.cards.len()
    }

    /// Returns true if the deck is empty.
    pub fn is_empty(&self) -> bool {
        self.cards.is_empty()
    }

    /// Resets the deck to a new unshuffled state.
    pub fn reset(&mut self) {
        *self = Self::new();
    }
}

impl Default for Deck {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use sb_shared_types::{Rank, Suit};

    #[test]
    fn test_new_deck_has_52_cards() {
        let deck = Deck::new();
        assert_eq!(deck.len(), 52);
    }

    #[test]
    fn test_deck_order_clubs_first() {
        let deck = Deck::new();
        assert_eq!(deck.cards[0].suit(), Suit::Club);
        assert_eq!(deck.cards[0].rank(), Rank::Number(2));
        assert_eq!(deck.cards[12].rank(), Rank::Ace);
        assert_eq!(deck.cards[13].suit(), Suit::Diamond);
    }

    #[test]
    fn test_shuffle_changes_order() {
        let mut deck = Deck::new();
        let original = deck.cards.clone();
        deck.shuffle();
        assert_ne!(deck.cards, original);
    }

    #[test]
    fn test_deal_removes_card() {
        let mut deck = Deck::new();
        let card = deck.deal().unwrap();
        assert_eq!(deck.len(), 51);
        // Dealt card should be the last card (since we pop)
        let last_original = Deck::new().cards.last().unwrap();
        assert_eq!(&card, last_original);
    }

    #[test]
    fn test_deal_empty() {
        let mut deck = Deck::new();
        for _ in 0..52 {
            deck.deal();
        }
        assert!(deck.deal().is_none());
    }

    #[test]
    fn test_reset() {
        let mut deck = Deck::new();
        deck.shuffle();
        let shuffled = deck.cards.clone();
        deck.reset();
        assert_eq!(deck.cards, Deck::new().cards);
        assert_ne!(deck.cards, shuffled);
    }
}

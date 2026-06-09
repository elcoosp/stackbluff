//! Standard 52-card deck.
use rand::Rng;
use sb_shared_types::{Card, Suit, Rank};

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Deck {
    cards: Vec<Card>,
}

impl Deck {
    pub fn new() -> Self {
        let mut cards = Vec::with_capacity(52);
        for suit in [Suit::Clubs, Suit::Diamonds, Suit::Hearts, Suit::Spades] {
            for value in 2..=14 {
                let rank = match value {
                    11 => Rank::Jack,
                    12 => Rank::Queen,
                    13 => Rank::King,
                    14 => Rank::Ace,
                    v => Self::int_to_rank(v),
                };
                cards.push(Card { suit, rank });
            }
        }
        Deck { cards }
    }

    fn int_to_rank(v: u8) -> Rank {
        match v {
            2 => Rank::Two,
            3 => Rank::Three,
            4 => Rank::Four,
            5 => Rank::Five,
            6 => Rank::Six,
            7 => Rank::Seven,
            8 => Rank::Eight,
            9 => Rank::Nine,
            10 => Rank::Ten,
            _ => panic!("Invalid rank value"),
        }
    }

    /// Shuffles the deck using the given RNG.
    pub fn shuffle_with<R: Rng>(&mut self, rng: &mut R) {
        use rand::seq::SliceRandom;
        self.cards.shuffle(rng);
    }

    /// Shuffles using the default CSPRNG ().
    pub fn shuffle(&mut self) {
        self.shuffle_with(&mut rand::rng());
    }

    pub fn deal(&mut self) -> Option<Card> {
        self.cards.pop()
    }

    pub fn len(&self) -> usize {
        self.cards.len()
    }

    pub fn is_empty(&self) -> bool {
        self.cards.is_empty()
    }

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
    use rand::SeedableRng;
    use rand::rngs::StdRng;

    #[test]
    fn test_new_deck_has_52_cards() {
        let deck = Deck::new();
        assert_eq!(deck.len(), 52);
    }

    #[test]
    fn test_shuffle_changes_order() {
        let mut deck = Deck::new();
        let original = deck.cards.clone();
        deck.shuffle();
        assert_ne!(deck.cards, original);
    }

    #[test]
    fn test_deterministic_shuffle() {
        let mut deck = Deck::new();
        let mut rng = StdRng::seed_from_u64(42);
        deck.shuffle_with(&mut rng);
        let first_card = deck.cards[0];
        let mut deck2 = Deck::new();
        let mut rng2 = StdRng::seed_from_u64(42);
        deck2.shuffle_with(&mut rng2);
        assert_eq!(first_card, deck2.cards[0]);
    }

    #[test]
    fn test_deal_removes_card() {
        let mut deck = Deck::new();
        let _ = deck.deal().unwrap();
        assert_eq!(deck.len(), 51);
    }

    #[test]
    fn test_deal_empty() {
        let mut deck = Deck::new();
        for _ in 0..52 { deck.deal(); }
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

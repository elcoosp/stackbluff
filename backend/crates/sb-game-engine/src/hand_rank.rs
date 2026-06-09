//! Hand rank definitions.

use strum::{EnumIter, FromRepr};

#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, EnumIter, FromRepr)]
#[repr(u8)]
pub enum HandRank {
    HighCard = 1,
    OnePair = 2,
    TwoPair = 3,
    ThreeOfAKind = 4,
    Straight = 5,
    Flush = 6,
    FullHouse = 7,
    FourOfAKind = 8,
    StraightFlush = 9,
}

impl HandRank {
    pub fn name(&self) -> &'static str {
        match self {
            HandRank::HighCard => "High Card",
            HandRank::OnePair => "One Pair",
            HandRank::TwoPair => "Two Pair",
            HandRank::ThreeOfAKind => "Three of a Kind",
            HandRank::Straight => "Straight",
            HandRank::Flush => "Flush",
            HandRank::FullHouse => "Full House",
            HandRank::FourOfAKind => "Four of a Kind",
            HandRank::StraightFlush => "Straight Flush",
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn test_ordering() {
        assert!(HandRank::HighCard < HandRank::OnePair);
        assert!(HandRank::StraightFlush > HandRank::FourOfAKind);
    }
    #[test]
    fn test_name() {
        assert_eq!(HandRank::StraightFlush.name(), "Straight Flush");
    }
}


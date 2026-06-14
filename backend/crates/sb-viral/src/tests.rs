#[cfg(test)]
mod tests {
    use sb_contracts::service_api::{HandResult, ViralService};
    use sb_shared_types::{HandRank, ChipAmount, UserId, TableId};

    #[tokio::test]
    async fn test_hand_qualifies_for_replay_card() {
        let hand = HandResult {
            hand_rank: HandRank::StraightFlush,
            pot_size: ChipAmount::new(1000).unwrap(),
            is_all_in: false,
            is_tournament_ko: false,
        };
        assert!(hand.is_significant());
    }

    #[tokio::test]
    async fn test_replay_card_generation() {
        let hand = HandResult {
            hand_rank: HandRank::FourOfAKind,
            pot_size: ChipAmount::new(500).unwrap(),
            is_all_in: true,
            is_tournament_ko: false,
        };
        assert!(hand.is_significant());
    }
}

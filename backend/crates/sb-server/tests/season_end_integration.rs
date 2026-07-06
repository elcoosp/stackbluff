//! Integration test for season end processing.
//! Requires a test database and mocked R2 / notifier.

#[tokio::test]
async fn test_season_end_creates_cards_and_resets_ranks() {
    // TODO: bootstrap test DB, insert season + player_ranks,
    // run SeasonCardGenerator::process_season, assert:
    // 1. user_season_cards row exists
    // 2. next season player_ranks row exists with reset tier
    // 3. season.processed == true
}

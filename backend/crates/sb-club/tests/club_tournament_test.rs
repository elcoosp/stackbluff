//! Integration tests for club tournament scheduling via ClubService.

use sb_contracts::tournament_api::{
    BlindLevel, PayoutPosition, PayoutStructure, TournamentConfig,
};
use sb_shared_types::ids::ClubId;

#[test]
fn test_club_tournament_config_creation() {
    let config = TournamentConfig {
        name: "Sunday Special".to_string(),
        max_players: 50,
        buy_in: 1000,
        starting_chips: 10000,
        blind_levels: vec![
            BlindLevel {
                small_blind: 25,
                big_blind: 50,
                duration_secs: 600,
                ante: None,
            },
            BlindLevel {
                small_blind: 50,
                big_blind: 100,
                duration_secs: 600,
                ante: Some(10),
            },
        ],
        payout_structure: PayoutStructure {
            positions: vec![
                PayoutPosition { placement: 1, percentage: 40.0 },
                PayoutPosition { placement: 2, percentage: 25.0 },
                PayoutPosition { placement: 3, percentage: 15.0 },
                PayoutPosition { placement: 4, percentage: 10.0 },
                PayoutPosition { placement: 5, percentage: 10.0 },
            ],
        },
        club_id: Some(ClubId(1)),
        scheduled_start: Some(chrono::Utc::now()),
        blind_schedule_id: None,
    };

    assert_eq!(config.club_id, Some(ClubId(1)));
    assert_eq!(config.max_players, 50);
    assert_eq!(config.blind_levels.len(), 2);
}

#[test]
fn test_non_club_tournament_config() {
    let json = r#"{
        "name": "Open Tournament",
        "max_players": 200,
        "buy_in": 500,
        "starting_chips": 5000,
        "blind_levels": [],
        "payout_structure": { "positions": [] }
    }"#;

    let config: TournamentConfig = serde_json::from_str(json).unwrap();
    assert!(config.club_id.is_none());
}

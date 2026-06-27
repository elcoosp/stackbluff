//! Integration tests for club tournament scheduling and result posting.

use sb_contracts::tournament_api::{
    BlindLevel, PayoutPosition, PayoutStructure, TournamentCompletedEvent,
    TournamentConfig, TournamentRanking, TournamentSummary,
};
use sb_shared_types::ids::ClubId;

#[test]
fn test_tournament_config_with_club_id_serialization() {
    let config = TournamentConfig {
        name: "Weekly Club MTT".to_string(),
        max_players: 20,
        buy_in: 500,
        starting_chips: 5000,
        blind_levels: vec![BlindLevel {
            small_blind: 25,
            big_blind: 50,
            duration_secs: 600,
            ante: None,
        }],
        payout_structure: PayoutStructure {
            positions: vec![
                PayoutPosition { placement: 1, percentage: 50.0 },
                PayoutPosition { placement: 2, percentage: 30.0 },
                PayoutPosition { placement: 3, percentage: 20.0 },
            ],
        },
        club_id: Some(ClubId(42)),
        scheduled_start: Some(chrono::Utc::now()),
        blind_schedule_id: None,
    };

    let json = serde_json::to_string(&config).expect("Failed to serialize");
    let deserialized: TournamentConfig =
        serde_json::from_str(&json).expect("Failed to deserialize");

    assert_eq!(deserialized.club_id, Some(ClubId(42)));
    assert!(deserialized.scheduled_start.is_some());
}

#[test]
fn test_tournament_config_without_club_id_backward_compat() {
    let json = r#"{
        "name": "Open MTT",
        "max_players": 100,
        "buy_in": 1000,
        "starting_chips": 10000,
        "blind_levels": [],
        "payout_structure": { "positions": [] }
    }"#;

    let config: TournamentConfig =
        serde_json::from_str(json).expect("Failed to deserialize");

    assert_eq!(config.club_id, None);
    assert_eq!(config.scheduled_start, None);
    assert_eq!(config.blind_schedule_id, None);
}

#[test]
fn test_tournament_completed_event_serialization() {
    let event = TournamentCompletedEvent {
        tournament_id: uuid::Uuid::new_v4(),
        club_id: Some(ClubId(1)),
        tournament_name: "Test Tournament".to_string(),
        final_rankings: vec![
            TournamentRanking {
                user_id: 1,
                display_name: "Alice".to_string(),
                placement: 1,
                prize_amount: 5000,
            },
            TournamentRanking {
                user_id: 2,
                display_name: "Bob".to_string(),
                placement: 2,
                prize_amount: 3000,
            },
        ],
    };

    let json = serde_json::to_string(&event).expect("Failed to serialize");
    let deserialized: TournamentCompletedEvent =
        serde_json::from_str(&json).expect("Failed to deserialize");

    assert_eq!(deserialized.final_rankings.len(), 2);
    assert_eq!(deserialized.final_rankings[0].placement, 1);
}

#[test]
fn test_tournament_summary_serialization() {
    let summary = TournamentSummary {
        tournament_id: uuid::Uuid::new_v4(),
        name: "Weekly MTT".to_string(),
        status: "scheduled".to_string(),
        scheduled_start: Some(chrono::Utc::now()),
        player_count: 15,
        club_id: Some(ClubId(1)),
    };

    let json = serde_json::to_string(&summary).expect("Failed to serialize");
    assert!(json.contains("club_id"));
}

#[test]
fn test_club_id_equality() {
    let club1 = ClubId(1);
    let club2 = ClubId(1);
    let club3 = ClubId(2);

    assert_eq!(club1, club2);
    assert_ne!(club1, club3);
}

#[test]
fn test_xp_values() {
    const XP_PER_HAND: i64 = 5;
    const XP_FOR_WIN: i64 = 50;

    let hands_played = 20;
    let hands_won = 3;
    let expected_xp = hands_played * XP_PER_HAND + hands_won * XP_FOR_WIN;

    assert_eq!(expected_xp, 250);
}

#![allow(dead_code)]

use std::sync::Arc;
use std::time::Duration;

use tokio::sync::mpsc;

use sb_contracts::tournament_api::TournamentConfig;
use sb_shared_types::{ChipAmount, TournamentId, UserId};
use sb_table_registry::connection_broker::ConnectionBroker;

use sb_table_registry::registry::Registry;

// ─── Dummy Repo for Tests ──────────────────────────────────────────────────
struct DummyStatsRepo;

#[async_trait::async_trait]
impl sb_contracts::stats_api::PlayerStatsRepo for DummyStatsRepo {
    async fn get(
        &self,
        _user_id: &str,
    ) -> Result<
        sb_shared_types::player_stats::PlayerStatsDto,
        sb_contracts::repo_api::PersistenceError,
    > {
        Ok(Default::default())
    }

    async fn apply_delta(
        &self,
        _delta: sb_shared_types::player_stats::StatsDelta,
    ) -> Result<(), sb_contracts::repo_api::PersistenceError> {
        Ok(())
    }
}

// ─── Helper functions for tests ────────────────────────────────────────────

fn make_blind_schedule() -> sb_contracts::tournament_api::BlindSchedule {
    use sb_contracts::tournament_api::BlindLevel;
    sb_contracts::tournament_api::BlindSchedule {
        levels: vec![
            BlindLevel {
                level: 1,
                small_blind: 10,
                big_blind: 20,
                ante: 0,
                duration_seconds: 600,
            },
            BlindLevel {
                level: 2,
                small_blind: 15,
                big_blind: 30,
                ante: 0,
                duration_seconds: 600,
            },
        ],
    }
}

fn make_payout_structure() -> sb_contracts::tournament_api::PayoutStructure {
    use sb_contracts::tournament_api::PayoutEntry;
    sb_contracts::tournament_api::PayoutStructure {
        entries: vec![
            PayoutEntry {
                position: 1,
                percentage: 0.65,
            },
            PayoutEntry {
                position: 2,
                percentage: 0.35,
            },
        ],
    }
}

// ─── Tournament config builder (with all fields) ──────────────────────────

fn make_config(max_players: u32) -> TournamentConfig {
    TournamentConfig {
        club_id: None,
        scheduled_start: None,
        blind_schedule_id: None,
        tournament_type: TournamentType::SitAndGo,
        max_players,
        buy_in: ChipAmount::new(1000).unwrap(),
        blind_schedule: make_blind_schedule(),
        payout_structure: make_payout_structure(),
        start_delay_seconds: 0,
        min_players_to_start: max_players,
    }
}

// ─── Tests ──────────────────────────────────────────────────────────────────

#[tokio::test(flavor = "current_thread")]
async fn test_sit_go_registration_messages_flow() {
    let stats_repo: Arc<dyn sb_contracts::stats_api::PlayerStatsRepo> = Arc::new(DummyStatsRepo);
    let registry = Arc::new(Registry::new(stats_repo));
    let broker = Arc::new(ConnectionBroker::new());

    let tournament_id = TournamentId::generate();
    let config = make_config(3);

    let (_cmd_tx, dummy_rx) = mpsc::channel(32);
    let event_rx = registry.event_sender().subscribe();

    let mut actor = crate::SitGoTournament::new(
        tournament_id,
        config,
        registry.clone(),
        broker.clone(),
        dummy_rx,
        event_rx,
        UserId::new(uuid::Uuid::nil()),
        None,
        None, // completion_tx = None for tests
    );

    let user_a = UserId::new(uuid::Uuid::new_v4());
    let user_b = UserId::new(uuid::Uuid::new_v4());

    let (tx_a, mut rx_a) = mpsc::unbounded_channel();
    let (tx_b, _rx_b) = mpsc::unbounded_channel();
    broker.register_user(user_a, tx_a);
    broker.register_user(user_b, tx_b);

    for &uid in &[user_a, user_b] {
        let (rtx, rrx) = tokio::sync::oneshot::channel();
        actor
            .handle_command(crate::SitGoCommand::Register {
                user_id: uid,
                respond_to: rtx,
            })
            .await;
        assert!(rrx.await.unwrap().is_ok());
    }

    tokio::time::sleep(Duration::from_millis(100)).await;

    let mut a_msgs = Vec::new();
    while let Ok(msg) = rx_a.try_recv() {
        a_msgs.push(msg);
    }

    assert!(
        a_msgs.iter().any(|m| matches!(
            m,
            sb_table_registry::game_room::RoomMessage::TournamentRegistered { .. }
        )),
        "User A should receive TournamentRegistered"
    );
}

#[tokio::test(flavor = "current_thread")]
async fn test_registration_full_rejects_overflow() {
    let stats_repo: Arc<dyn sb_contracts::stats_api::PlayerStatsRepo> = Arc::new(DummyStatsRepo);
    let registry = Arc::new(Registry::new(stats_repo));
    let broker = Arc::new(ConnectionBroker::new());

    let tournament_id = TournamentId::generate();
    let mut config = make_config(2);
    config.start_delay_seconds = 999; // long delay to keep Registering status

    let (_cmd_tx, dummy_rx) = mpsc::channel(32);
    let event_rx = registry.event_sender().subscribe();

    let mut actor = crate::SitGoTournament::new(
        tournament_id,
        config,
        registry.clone(),
        broker.clone(),
        dummy_rx,
        event_rx,
        UserId::new(uuid::Uuid::nil()),
        None,
        None, // completion_tx = None for tests
    );

    let ua = UserId::new(uuid::Uuid::new_v4());
    let ub = UserId::new(uuid::Uuid::new_v4());
    let uc = UserId::new(uuid::Uuid::new_v4());

    for &uid in &[ua, ub] {
        let (rtx, rrx) = tokio::sync::oneshot::channel();
        actor
            .handle_command(crate::SitGoCommand::Register {
                user_id: uid,
                respond_to: rtx,
            })
            .await;
        assert!(rrx.await.unwrap().is_ok());
    }

    let (rtx, rrx) = tokio::sync::oneshot::channel();
    actor
        .handle_command(crate::SitGoCommand::Register {
            user_id: uc,
            respond_to: rtx,
        })
        .await;
    let result = rrx.await.unwrap();
    assert!(
        matches!(result, Err(sb_shared_types::AppError::TournamentFull)),
        "Expected TournamentFull, got {:?}",
        result
    );
}

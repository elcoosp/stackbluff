use sb_shared_types::{ChipAmount, GameVariant, StakeLevel, TableConfig, TableId, UserId};
use sb_table_registry::Registry;
use std::sync::Arc;
use tokio::sync::mpsc;
use uuid::Uuid;

// -----------------------------------------------------------------------------
// Dummy implementation of PlayerStatsRepo – not called in this test.
// -----------------------------------------------------------------------------
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
        unimplemented!()
    }

    async fn apply_delta(
        &self,
        _delta: sb_shared_types::player_stats::StatsDelta,
    ) -> Result<(), sb_contracts::repo_api::PersistenceError> {
        unimplemented!()
    }
}

#[tokio::test]
async fn test_registry_creates_table_and_joins_player() {
    let stats_repo = Arc::new(DummyStatsRepo);
    let registry = Registry::new(stats_repo);

    let config = TableConfig {
        stake_level: StakeLevel::Low,
        max_players: 6,
        variant: GameVariant::Holdem,
        min_buy_in: ChipAmount::new(100).unwrap(),
        max_buy_in: ChipAmount::new(1000).unwrap(),
        turn_time_limit_ms: 30000,
    };

    let table_id = registry.create_table(config, sb_shared_types::UserId::new(uuid::Uuid::nil()), None).await;
    assert_ne!(table_id, TableId(Uuid::nil()));

    let user_id = UserId(Uuid::new_v4());

    let room_id = registry
        .assign_room(table_id, vec![])
        .await
        .expect("assign_room should succeed");

    let (msg_tx, _) = mpsc::unbounded_channel();
    let stack = ChipAmount::new(500).unwrap();

    let result = registry
        .join_room_full(
            room_id,
            user_id,
            "TestPlayer".to_string(),
            None,
            stack,
            msg_tx,
            false,
        )
        .await;

    assert!(result.is_ok());
}

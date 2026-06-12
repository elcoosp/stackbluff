use sb_shared_types::{ChipAmount, GameVariant, StakeLevel, TableConfig, TableId, UserId};
use sb_table_registry::Registry;
use uuid::Uuid;

#[tokio::test]
async fn test_registry_creates_table_and_joins_player() {
    let registry = Registry::new();
    let config = TableConfig {
        stake_level: StakeLevel::Low,
        max_players: 6,
        variant: GameVariant::Holdem,
        min_buy_in: ChipAmount::new(100).unwrap(),
        max_buy_in: ChipAmount::new(1000).unwrap(),
    };
    let table_id = registry.create_table(config).await;
    assert_ne!(table_id, TableId(Uuid::nil()));
    let user_id = UserId(Uuid::new_v4());
    let result = registry
        .join_table_full(table_id, user_id, 0, ChipAmount::new(500).unwrap())
        .await;
    assert!(result.is_ok());
}

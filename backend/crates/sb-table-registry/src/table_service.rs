use async_trait::async_trait;
use sb_contracts::lobby_api::{TableRepo, TableService};
use sb_shared_types::{AppError, ChipAmount, GameVariant, StakeLevel, TableConfig, TableId};
use std::sync::Arc;

use crate::registry::Registry;

pub struct TableServiceImpl {
    registry: Arc<Registry>,
    table_repo: Arc<dyn TableRepo + Send + Sync>,
}

impl TableServiceImpl {
    pub fn new(registry: Arc<Registry>, table_repo: Arc<dyn TableRepo + Send + Sync>) -> Self {
        Self {
            registry,
            table_repo,
        }
    }
}

#[async_trait]
impl TableService for TableServiceImpl {
    async fn create_cash_table(
        &self,
        stake_level: StakeLevel,
        max_players: u32,
    ) -> Result<TableId, AppError> {
        // 1. Write to DB first — DB is the source of truth, generates the ID
        let name = Some(format!("{:?} Table", stake_level));
        let table_id = self
            .table_repo
            .create_table(name, stake_level, max_players)
            .await?;

        // 2. Register in Registry with the DB-assigned ID
        let config = TableConfig {
            max_players: max_players as u8,
            stake_level,
            variant: GameVariant::Holdem,
            min_buy_in: ChipAmount::new(100).unwrap(),
            max_buy_in: ChipAmount::new(10000).unwrap(),
        };
        self.registry
            .register_existing_table(table_id, config)
            .await;

        Ok(table_id)
    }
}

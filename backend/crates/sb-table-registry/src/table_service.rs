use crate::Registry;
use async_trait::async_trait;
use sb_contracts::lobby_api::TableService;
use sb_shared_types::{AppError, ChipAmount, GameVariant, StakeLevel, TableConfig, TableId};
use std::sync::Arc;

pub struct TableServiceImpl {
    registry: Arc<Registry>,
}

impl TableServiceImpl {
    pub fn new(registry: Arc<Registry>) -> Self {
        Self { registry }
    }
}

#[async_trait]
impl TableService for TableServiceImpl {
    async fn create_cash_table(
        &self,
        stake_level: StakeLevel,
        max_players: u32,
    ) -> Result<TableId, AppError> {
        let config = TableConfig {
            max_players: max_players as u8,
            stake_level,
            variant: GameVariant::Holdem,
            min_buy_in: ChipAmount::new(100).unwrap(),
            max_buy_in: ChipAmount::new(10000).unwrap(),
        };
        let table_id = self.registry.create_table(config).await;
        // TODO: update table name in database
        // For now, ignore name parameter
        Ok(table_id)
    }
}

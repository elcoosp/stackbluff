use async_trait::async_trait;
use sb_contracts::lobby_api::{TableRepo, TableService};
use sb_shared_types::{AppError, GameVariant, StakeLevel, TableConfig, TableId, UserId};
use std::sync::Arc;

use crate::actor::buy_in_limits_for_stake;
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
        created_by: UserId,
        chat_id: Option<String>,
    ) -> Result<TableId, AppError> {
        let name = Some(format!("{:?} Table", stake_level));
        let table_id = self
            .table_repo
            .create_table(name, stake_level, max_players)
            .await?;

        let (min_buy_in, max_buy_in) = buy_in_limits_for_stake(stake_level);
        let config = TableConfig {
            max_players: max_players as u8,
            stake_level,
            variant: GameVariant::Holdem,
            min_buy_in,
            max_buy_in,
            turn_time_limit_ms: 30_000,
        };
        let default_creator = sb_shared_types::UserId::new(uuid::Uuid::nil());
        self.registry
<<<<<<< HEAD
            .register_existing_table(table_id, config, default_creator, None)
||||||| 18bcddd
            .register_existing_table(table_id, config)
=======
            .register_existing_table(table_id, config, created_by, chat_id)
>>>>>>> origin/main
            .await;

        Ok(table_id)
    }
}

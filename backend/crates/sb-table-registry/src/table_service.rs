use async_trait::async_trait;
use sb_contracts::lobby_api::{CreateTableInput, TableRepo, TableService};
use sb_shared_types::{AppError, GameVariant, StakeLevel, TableConfig, TableId, UserId};
use std::sync::Arc;

use crate::actor::buy_in_limits_for_stake;
use crate::registry::Registry;

/// Default number of players for tables created via the bot if not specified.
const DEFAULT_MAX_PLAYERS: u32 = 6;

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
    async fn create_table(
        &self,
        _ctx: &sb_shared_types::RequestContext,
        input: CreateTableInput,
    ) -> Result<TableId, AppError> {
        // Use the provided max_players or fallback to default
        let max_players = if input._max_players > 0 {
            input._max_players
        } else {
            DEFAULT_MAX_PLAYERS
        };
        let stake_level = input.stake_level;

        let table_id = self
            .table_repo
            .create_table(Some(input.name), stake_level, max_players)
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

        self.registry
            .register_existing_table(table_id, config, input.created_by, input.telegram_chat_id)
            .await;

        Ok(table_id)
    }

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

        self.registry
            .register_existing_table(table_id, config, created_by, chat_id)
            .await;

        Ok(table_id)
    }
}

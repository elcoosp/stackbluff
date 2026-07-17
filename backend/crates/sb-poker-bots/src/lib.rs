//! sb-poker-bots: Modular bot system for the StackBluff cash game platform.
//!
//! This crate encapsulates all bot-related logic behind strict trait
//! boundaries so that bots can never pollute human competitive metrics.

pub mod actor;
pub mod economy;
pub mod engine;
pub mod evaluator;

use async_trait::async_trait;
use dashmap::DashMap;
use sb_shared_types::errors::AppError;
use sb_shared_types::{ActionType, ChipAmount, TableId, UserId};
use sb_table_registry::game_room::RoomMessage;
use std::sync::Arc;
use tokio::sync::mpsc;

use crate::actor::BotActor;
use crate::economy::BankrollManager;
use crate::engine::BotProfile;

/// Decoupling trait between the bot system and the live table actor
/// (`sb-table-registry`). The concrete implementation lives in `sb-server`
/// so that this crate never has to depend on the table actor internals.
#[async_trait]
pub trait TableClient: Send + Sync {
    /// Seat a bot at `room_id` with the requested `stack`.
    ///
    /// Returns `true` when this is a fresh join, `false` if the bot was
    /// already seated (reconnect semantics).
    async fn join_table(
        &self,
        room_id: TableId,
        user_id: UserId,
        stack: ChipAmount,
        msg_tx: mpsc::UnboundedSender<RoomMessage>,
    ) -> Result<bool, AppError>;

    /// Forward a poker action to the table actor on behalf of the bot.
    async fn send_action(
        &self,
        room_id: TableId,
        user_id: UserId,
        action_type: ActionType,
        amount: Option<ChipAmount>,
    ) -> Result<(), AppError>;

    /// Remove the bot from the table. When `force` is true, the bot is
    /// evicted even mid-hand (used for zombie recovery). Returns the
    /// refunded stack.
    async fn leave_table(
        &self,
        room_id: TableId,
        user_id: UserId,
        force: bool,
    ) -> Result<ChipAmount, AppError>;

    /// Toggle the bot's `sitting_out` flag. Used by the clean-exit
    /// algorithm to ensure the bot is not dealt into the next hand.
    async fn set_sitting_out(
        &self,
        room_id: TableId,
        user_id: UserId,
        sitting_out: bool,
    ) -> Result<(), AppError>;

    /// Get the table configuration (blinds, buy-in limits, etc.)
    async fn get_table_config(&self, room_id: TableId) -> Result<sb_shared_types::TableConfig, AppError>;

    /// Get the current number of active players at the table.
    async fn get_player_count(&self, room_id: TableId) -> Result<u8, AppError>;
}

pub struct BotManager {
    table_client: Arc<dyn TableClient>,
    bankroll_manager: Arc<BankrollManager>,
    bot_pool: Arc<DashMap<UserId, BotProfile>>,
}

impl BotManager {
    pub fn new(
        table_client: Arc<dyn TableClient>,
        bankroll_manager: Arc<BankrollManager>,
        bot_pool: Vec<(UserId, BotProfile)>,
    ) -> Self {
        let pool = DashMap::new();
        for (id, profile) in bot_pool {
            pool.insert(id, profile);
        }
        Self {
            table_client,
            bankroll_manager,
            bot_pool: Arc::new(pool),
        }
    }

    pub async fn fill_table(&self, table_id: TableId) -> Result<(), AppError> {
        let config = self.table_client.get_table_config(table_id).await?;
        let count = self.table_client.get_player_count(table_id).await?;

        if count >= config.max_players {
            return Ok(());
        }

        if count >= 2 {
            return Ok(()); // Only fill if empty or 1 player
        }

        if let Some(entry) = self.bot_pool.iter().next() {
            let bot_id = *entry.key();
            let profile = entry.value().clone();

            // Use min buy-in for simplicity
            let stack = config.min_buy_in;

            // 1. Reserve bankroll
            self.bankroll_manager
                .reserve_bankroll(bot_id, stack)
                .await
                .map_err(|e| AppError::Internal(e.to_string()))?;

            // 2. Create message channel
            let (msg_tx, msg_rx) = mpsc::unbounded_channel();

            // 3. Join table
            let joined = self.table_client
                .join_table(table_id, bot_id, stack, msg_tx)
                .await?;

            if joined {
                // 4. Spawn actor
                let actor = BotActor::new(
                    bot_id,
                    table_id,
                    profile,
                    self.table_client.clone(),
                    self.bankroll_manager.clone(),
                    stack,
                );
                tokio::spawn(actor.run(msg_rx));
            }
            Ok(())
        } else {
            Err(AppError::Internal("No bots available in pool".to_string()))
        }
    }

    pub fn spawn_auto_fill_task(
        self: Arc<Self>,
        registry: Arc<sb_table_registry::Registry>,
    ) {
        tokio::spawn(async move {
            loop {
                let tables = registry.list_active_tables().await;
                for table_info in tables {
                    if !self.bot_pool.is_empty() {
                        let _ = self.fill_table(table_info.table_id).await;
                    }
                }
                tokio::time::sleep(tokio::time::Duration::from_secs(5)).await;
            }
        });
    }
}

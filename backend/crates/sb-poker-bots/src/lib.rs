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

    pub async fn fill_table(
        &self,
        table_id: TableId,
        stack: ChipAmount,
    ) -> Result<(), AppError> {
        if let Some(entry) = self.bot_pool.iter().next() {
            let bot_id = *entry.key();
            let profile = entry.value().clone();

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
                    stack,
                );
                tokio::spawn(actor.run(msg_rx));
            }
            Ok(())
        } else {
            Err(AppError::Internal("No bots available in pool".to_string()))
        }
    }
}

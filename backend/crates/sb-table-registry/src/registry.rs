//! Real Registry – spawns table actors and routes commands.

use crate::actor::InternalCommand;
use sb_contracts::{TableCommand, TableError, lobby_api::TableInfo};
use sb_shared_types::{ChipAmount, PlayerId, TableConfig, TableId, UserId};
use sb_ws_handler::broadcast_channel;
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::{RwLock, mpsc, oneshot};

type ActorSender = mpsc::Sender<InternalCommand>;

/// Registry owns all active table actors and their command senders.
#[derive(Clone)]
pub struct Registry {
    tables: Arc<RwLock<HashMap<TableId, ActorSender>>>,
    configs: Arc<RwLock<HashMap<TableId, TableConfig>>>,
}

impl Registry {
    pub fn new() -> Self {
        Self {
            tables: Arc::new(RwLock::new(HashMap::new())),
            configs: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    /// Creates a new table, spawns its actor, and stores the sender.
    pub async fn create_table(&self, config: TableConfig) -> TableId {
        let table_id = TableId::new();
        let (broadcast_tx, _) = broadcast_channel(32);
        let (cmd_tx, _handle) = crate::actor::spawn_table_actor(table_id, config, broadcast_tx);
        let mut tables = self.tables.write().await;
        tables.insert(table_id, cmd_tx);
        let mut configs = self.configs.write().await;
        configs.insert(table_id, config);
        table_id
    }

    /// Gets the command sender for a table.
    async fn get_sender(&self, table_id: TableId) -> Option<ActorSender> {
        let tables = self.tables.read().await;
        tables.get(&table_id).cloned()
    }

    /// Sends a command to a table actor.
    pub async fn send_command(
        &self,
        table_id: TableId,
        cmd: TableCommand,
    ) -> Result<(), TableError> {
        let sender = self
            .get_sender(table_id)
            .await
            .ok_or(TableError::NotFound(table_id))?;
        let internal = match cmd {
            TableCommand::Join {
                table_id: _,
                response_tx,
                player_id,
                stack,
            } => {
                // The contract uses response_tx to send back result. We'll ignore for now.
                // We need to map player_id to user_id? Actually we don't have user_id here.
                // This is a design issue: contract's Join command doesn't contain user_id.
                // For now we'll stub – the real implementation would need user_id mapping.
                return Err(TableError::ActorError(
                    "Join not supported via send_command".into(),
                ));
            }
            TableCommand::Leave {
                table_id: _,
                response_tx,
            } => {
                return Err(TableError::ActorError(
                    "Leave not supported via send_command".into(),
                ));
            }
            TableCommand::Action {
                table_id: _,
                response_tx,
                action_type,
                amount,
            } => {
                // Need user_id – missing from contract. This is a fundamental issue.
                return Err(TableError::ActorError(
                    "Action not supported via send_command".into(),
                ));
            }
            TableCommand::StartHand {
                table_id: _,
                response_tx,
            } => InternalCommand::StartHand,
        };
        sender
            .send(internal)
            .await
            .map_err(|_| TableError::ActorError("actor died".into()))?;
        Ok(())
    }

    /// Joins a player to a table using dedicated method (bypassing send_command).
    /// This is a workaround for the missing user_id in the contract.
    pub async fn join_table_direct(
        &self,
        table_id: TableId,
        user_id: UserId,
        seat: u8,
        stack: ChipAmount,
    ) -> Result<(), TableError> {
        let sender = self
            .get_sender(table_id)
            .await
            .ok_or(TableError::NotFound(table_id))?;
        let cmd = InternalCommand::Join {
            user_id,
            seat,
            stack,
        };
        sender
            .send(cmd)
            .await
            .map_err(|_| TableError::ActorError("actor died".into()))
    }

    pub async fn join_table(
        &self,
        table_id: TableId,
        player_id: PlayerId,
        user_id: UserId,
        stack: ChipAmount,
    ) -> Result<(), TableError> {
        // Map player_id to a seat (simple round‑robin)
        let seat = (player_id.0.as_u128() % 6) as u8; // FIXME: better seat assignment
        self.join_table_direct(table_id, user_id, seat, stack).await
    }

    pub async fn heartbeat(&self, _table_id: TableId) {
        // No‑op – actors run independently
    }

    pub async fn list_active_tables(&self) -> Vec<TableInfo> {
        let configs = self.configs.read().await;
        configs
            .iter()
            .map(|(id, config)| TableInfo {
                table_id: *id,
                stake_level: config.stake_level,
                max_players: config.max_players,
                current_players: 0, // we don't track that yet
            })
            .collect()
    }

    pub async fn reaper_task(registry: Registry) {
        // In a real system, would periodically check for dead actors and remove them.
        // For now, just keep running.
        loop {
            tokio::time::sleep(tokio::time::Duration::from_secs(60)).await;
            // Could send a ping to each actor and remove if dead.
        }
    }
}

impl Default for Registry {
    fn default() -> Self {
        Self::new()
    }
}

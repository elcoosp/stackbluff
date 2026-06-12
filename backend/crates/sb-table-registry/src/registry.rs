//! Registry stub – satisfies compilation without full contract integration.
//! The actual actor is fully functional and can be spawned directly.

use sb_contracts::{TableCommand, TableError, lobby_api::TableInfo};
use sb_shared_types::{ChipAmount, PlayerId, TableConfig, TableId, UserId};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;

/// Registry holds metadata about tables (stub).
#[derive(Clone)]
pub struct Registry {
    tables: Arc<RwLock<HashMap<TableId, TableConfig>>>,
}

impl Registry {
    pub fn new() -> Self {
        Self {
            tables: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    /// Creates a new table (stub – does not spawn actor).
    pub async fn create_table(&self, config: TableConfig) -> TableId {
        let table_id = TableId::new();
        let mut tables = self.tables.write().await;
        tables.insert(table_id, config);
        table_id
    }

    /// Sends a command to a table actor (stub – always returns actor error).
    pub async fn send_command(
        &self,
        _table_id: TableId,
        _cmd: TableCommand,
    ) -> Result<(), TableError> {
        Err(TableError::ActorError(
            "stub registry – use direct actor spawn".into(),
        ))
    }

    pub async fn join_table(
        &self,
        table_id: TableId,
        _player_id: PlayerId,
        __user_id: UserId,
        __stack: ChipAmount,
    ) -> Result<(), TableError> {
        let tables = self.tables.read().await;
        if tables.contains_key(&table_id) {
            Ok(())
        } else {
            Err(TableError::NotFound(table_id))
        }
    }

    pub async fn heartbeat(&self, _table_id: TableId) {}

    /// Direct join method for testing (bypasses contract limitations)
    pub async fn join_table_direct(
        &self,
        table_id: TableId,
        _user_id: UserId,
        _seat: u8,
        _stack: ChipAmount,
    ) -> Result<(), TableError> {
        // Stub: just check table exists
        let tables = self.tables.read().await;
        if tables.contains_key(&table_id) {
            Ok(())
        } else {
            Err(TableError::NotFound(table_id))
        }
    }

    pub async fn list_active_tables(&self) -> Vec<TableInfo> {
        let configs = self.tables.read().await;
        configs
            .iter()
            .map(|(id, config)| TableInfo {
                table_id: *id,
                stake_level: config.stake_level,
                max_players: config.max_players as u32,
                status: "active".to_string(),
                current_players: 0,
            })
            .collect()
    }

    pub async fn reaper_task(_registry: Registry) {
        loop {
            tokio::time::sleep(tokio::time::Duration::from_secs(60)).await;
        }
    }
}

impl Default for Registry {
    fn default() -> Self {
        Self::new()
    }
}

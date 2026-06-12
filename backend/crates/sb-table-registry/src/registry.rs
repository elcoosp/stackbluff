//! Registry stub – minimal placeholder to satisfy sb-rest-router.
//! This does not interact with the actual actor (issue 009 focus is the actor itself).

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
        // In stub, pretend actor is dead
        Err(TableError::ActorError(
            "stub registry – actor not implemented".into(),
        ))
    }

    /// Called when a player joins a table (stub).
    pub async fn join_table(
        &self,
        table_id: TableId,
        _player_id: PlayerId,
        _user_id: UserId,
        _stack: ChipAmount,
    ) -> Result<(), TableError> {
        let tables = self.tables.read().await;
        if tables.contains_key(&table_id) {
            Ok(())
        } else {
            Err(TableError::NotFound(table_id))
        }
    }

    /// Heartbeat to keep table alive (stub).
    pub async fn heartbeat(&self, _table_id: TableId) {
        // Nothing
    }

    /// Returns a list of active tables (stub).
    pub async fn list_active_tables(&self) -> Vec<TableInfo> {
        // Return empty list
        Vec::new()
    }

    /// Reaper task that cleans up dead tables (stub).
    pub async fn reaper_task(_registry: Registry) {
        loop {
            tokio::time::sleep(tokio::time::Duration::from_secs(60)).await;
            // No cleanup in stub
        }
    }
}

impl Default for Registry {
    fn default() -> Self {
        Self::new()
    }
}

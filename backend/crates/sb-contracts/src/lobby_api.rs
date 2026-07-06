use async_trait::async_trait;
use sb_shared_types::{AppError, StakeLevel, TableId, UserId}; // added UserId
use serde::{Deserialize, Serialize};

/// Public information about a table, used for lobby listing.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TableInfo {
    pub table_id: TableId,
    pub name: String,
    pub stake_level: StakeLevel,
    pub current_players: u32,
    pub max_players: u32,
    pub status: String,
}

/// Repository trait for persistent table storage.
#[async_trait]
pub trait TableRepo: Send + Sync {
    async fn list_tables(&self) -> Result<Vec<TableInfo>, AppError>;
    async fn create_table(
        &self,
        name: Option<String>,
        stake_level: StakeLevel,
        max_players: u32,
    ) -> Result<TableId, AppError>;
}

/// Service for table operations (creates table and registers actor).
#[async_trait]
pub trait TableService: Send + Sync {
    async fn create_cash_table(
        &self,
        stake_level: StakeLevel,
        max_players: u32,
        created_by: UserId,      // new parameter
        chat_id: Option<String>, // new parameter
    ) -> Result<TableId, AppError>;
}

use async_trait::async_trait;
use sb_shared_types::{AppError, ClubId, GameVariant, StakeLevel, TableId, UserId};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

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

/// Input for creating a new table (used by both REST and bot).
#[derive(Debug, Clone)]
pub struct CreateTableInput {
    pub name: String,
    pub club_id: Option<ClubId>,
    pub stake_level: StakeLevel,
    pub variant: GameVariant,
    pub is_private: bool,
    pub invited_users: Vec<UserId>,
    pub created_by: UserId,
    pub telegram_chat_id: Option<String>,
    /// Not used in the input; the service will use a default (6).
    pub _max_players: u32, // <-- prefixed with underscore to avoid unused warning
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

/// Unified service for table operations.
#[async_trait]
pub trait TableService: Send + Sync {
    /// Create a table with full options.
    async fn create_table(
        &self,
        ctx: &sb_shared_types::RequestContext,
        input: CreateTableInput,
    ) -> Result<TableId, AppError>;

    /// Simplified wrapper for cash tables (used by REST).
    async fn create_cash_table(
        &self,
        stake_level: StakeLevel,
        max_players: u32,
        created_by: UserId,
        chat_id: Option<String>,
    ) -> Result<TableId, AppError> {
        let input = CreateTableInput {
            name: format!("{:?} Table", stake_level),
            club_id: None,
            stake_level,
            variant: GameVariant::Holdem,
            is_private: false,
            invited_users: vec![],
            created_by,
            telegram_chat_id: chat_id,
            _max_players: max_players,
        };
        let ctx = sb_shared_types::RequestContext::new(Uuid::new_v4(), Some(created_by));
        self.create_table(&ctx, input).await
    }
}

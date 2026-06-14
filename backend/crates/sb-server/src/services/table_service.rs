use async_trait::async_trait;
use sb_contracts::service_api::{CreateTableInput, TableService};
use sb_shared_types::game_types::{GameVariant, StakeLevel};
use sb_shared_types::{AppError, RequestContext, TableId, UserId};
use std::collections::HashMap;
use std::sync::Arc;
use parking_lot::RwLock;

/// Simple in-memory table representation.
#[derive(Debug, Clone)]
#[allow(dead_code)]
pub struct Table {
    pub id: TableId,
    pub name: String,
    pub club_id: Option<sb_shared_types::ClubId>,
    pub variant: GameVariant,
    pub stake_level: StakeLevel,
    pub created_by: UserId,
    pub is_private: bool,
    pub invited_users: Vec<UserId>,
}

pub struct InMemoryTableService {
    tables: Arc<RwLock<HashMap<TableId, Table>>>,
}

impl Default for InMemoryTableService {
    fn default() -> Self {
        Self::new()
    }
}

impl InMemoryTableService {
    pub fn new() -> Self {
        Self {
            tables: Arc::new(RwLock::new(HashMap::new())),
        }
    }
}

#[async_trait]
impl TableService for InMemoryTableService {
    async fn create_table(
        &self,
        _ctx: &RequestContext,
        input: CreateTableInput,
    ) -> Result<TableId, AppError> {
        let id = TableId::new();
        let table = Table {
            id,
            name: input.name,
            club_id: input.club_id,
            variant: input.variant,
            stake_level: input.stake_level,
            created_by: input.created_by,
            is_private: input.is_private,
            invited_users: input.invited_users,
        };
        self.tables.write().insert(id, table);
        Ok(id)
    }

    async fn join_table(
        &self,
        _user_id: UserId,
        _table_id: TableId,
        _ctx: &RequestContext,
    ) -> Result<(), AppError> {
        // TODO: implement join logic
        Ok(())
    }

    async fn leave_table(
        &self,
        _user_id: UserId,
        _table_id: TableId,
        _ctx: &RequestContext,
    ) -> Result<(), AppError> {
        // TODO: implement leave logic
        Ok(())
    }
}

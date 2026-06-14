//! In-memory table service stub for testing.

#[cfg(feature = "test-stubs")]
use async_trait::async_trait;
#[cfg(feature = "test-stubs")]
use parking_lot::RwLock;
#[cfg(feature = "test-stubs")]
use sb_contracts::service_api::{CreateTableInput, TableService};
#[cfg(feature = "test-stubs")]
use sb_shared_types::game_types::{GameVariant, StakeLevel};
#[cfg(feature = "test-stubs")]
use sb_shared_types::{AppError, RequestContext, TableId, UserId};
#[cfg(feature = "test-stubs")]
use std::collections::HashMap;
#[cfg(feature = "test-stubs")]
use std::sync::Arc;

#[cfg(feature = "test-stubs")]
#[allow(dead_code)]
#[derive(Debug, Clone)]
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

#[cfg(feature = "test-stubs")]
pub struct InMemoryTableService {
    tables: Arc<RwLock<HashMap<TableId, Table>>>,
}

#[cfg(feature = "test-stubs")]
impl InMemoryTableService {
    pub fn new() -> Self {
        Self {
            tables: Arc::new(RwLock::new(HashMap::new())),
        }
    }
}

#[cfg(feature = "test-stubs")]
#[async_trait]
impl TableService for InMemoryTableService {
    async fn create_table(
        &self,
        _ctx: &RequestContext,
        input: CreateTableInput,
    ) -> Result<TableId, AppError> {
        let id = TableId::generate();
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
        Ok(())
    }

    async fn leave_table(
        &self,
        _user_id: UserId,
        _table_id: TableId,
        _ctx: &RequestContext,
    ) -> Result<(), AppError> {
        Ok(())
    }
}

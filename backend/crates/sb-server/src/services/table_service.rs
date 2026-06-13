use async_trait::async_trait;
use sb_contracts::service_api::{CreateTableInput, Table, TableService};
use sb_contracts::persistence_error::PersistenceError;
use sb_shared_types::ids::TableId;
use sb_shared_types::request_context::RequestContext;
use std::collections::HashMap;
use parking_lot::RwLock;
use uuid::Uuid;

pub struct InMemoryTableService {
    tables: RwLock<HashMap<TableId, Table>>,
}

impl InMemoryTableService {
    pub fn new() -> Self {
        Self { tables: RwLock::new(HashMap::new()) }
    }
}

#[async_trait]
impl TableService for InMemoryTableService {
    async fn create_table(&self, _ctx: &RequestContext, input: CreateTableInput) -> Result<TableId, PersistenceError> {
        let id = TableId::from_uuid(Uuid::new_v4());
        let table = Table {
            id: id.clone(),
            name: input.name,
            config: sb_shared_types::game_types::TableConfig {
                stake_level: input.stake_level,
                variant: input.variant,
                min_players: 2,
                max_players: 9,
            },
        };
        self.tables.write().insert(id.clone(), table);
        Ok(id)
    }

    async fn get_table(&self, _ctx: &RequestContext, table_id: TableId) -> Result<Table, PersistenceError> {
        self.tables.read().get(&table_id).cloned().ok_or(PersistenceError::NotFound)
    }
}

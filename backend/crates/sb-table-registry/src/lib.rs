use sb_contracts::TableCommand;
use sb_shared_types::{TableId, TableConfig, PlayerId};
use std::collections::HashMap;
use std::sync::{Arc, RwLock};
use tokio::sync::mpsc;
use tokio::time::{self, Duration};
use tracing::info;

#[derive(Clone)]
pub struct Registry {
    inner: Arc<RwLock<HashMap<TableId, mpsc::Sender<TableCommand>>>>,
}

impl Registry {
    pub fn new() -> Self {
        Self { inner: Arc::new(RwLock::new(HashMap::new())) }
    }

    pub async fn create_table(&self, config: TableConfig) -> TableId {
        let table_id = TableId::new();
        let (tx, rx) = mpsc::channel(32);
        tokio::spawn(table_actor(table_id, rx, config));
        self.inner.write().unwrap().insert(table_id, tx);
        info!(%table_id, "table created");
        table_id
    }

    pub async fn join_table(&self, table_id: TableId, player_id: PlayerId) -> anyhow::Result<()> {
        let sender = self.inner.read().unwrap().get(&table_id).cloned()
            .ok_or_else(|| anyhow::anyhow!("table not found"))?;
        sender.send(TableCommand::Join { player_id, table_id }).await?;
        Ok(())
    }

    pub async fn reaper_task(_registry: Registry) {
        let mut interval = time::interval(Duration::from_secs(60));
        loop {
            interval.tick().await;
            info!("reaper tick (stub)");
        }
    }
}

impl Default for Registry {
    fn default() -> Self {
        Self::new()
    }
}

async fn table_actor(table_id: TableId, mut rx: mpsc::Receiver<TableCommand>, _config: TableConfig) {
    info!(%table_id, "table actor started");
    while let Some(cmd) = rx.recv().await {
        match cmd {
            TableCommand::Join { player_id, .. } => info!(%table_id, %player_id, "player joined (stub)"),
        }
    }
    info!(%table_id, "table actor stopped");
}

use sb_contracts::TableCommand;
use sb_shared_types::{TableId, TableConfig, PlayerId};
use std::collections::HashMap;
use std::sync::{Arc, RwLock};
use tokio::sync::mpsc;
use tokio::time::{self, Duration};
use tracing::{info, warn};

#[derive(Clone)]
pub struct Registry {
    inner: Arc<RwLock<HashMap<TableId, mpsc::Sender<TableCommand>>>>,
}

impl Registry {
    pub fn new() -> Self {
        Self {
            inner: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    pub async fn create_table(&self, config: TableConfig) -> TableId {
        let table_id = TableId::new();
        let (tx, rx) = mpsc::channel(32);
        tokio::spawn(table_actor(table_id, rx, config));
        {
            let mut map = self.inner.write().unwrap();
            map.insert(table_id, tx);
        }
        info!(%table_id, "table created");
        table_id
    }

    pub async fn join_table(&self, table_id: TableId, player_id: PlayerId) -> anyhow::Result<()> {
        let map = self.inner.read().unwrap();
        let sender = map.get(&table_id).ok_or_else(|| anyhow::anyhow!("table not found"))?;
        let cmd = TableCommand::Join { player_id, table_id };
        sender.send(cmd).await?;
        Ok(())
    }

    pub async fn reaper_task(registry: Registry) {
        let mut interval = time::interval(Duration::from_secs(60));
        loop {
            interval.tick().await;
            info!("reaper tick: scanning for stale tables (stub)");
        }
    }
}

async fn table_actor(
    table_id: TableId,
    mut rx: mpsc::Receiver<TableCommand>,
    _config: TableConfig,
) {
    info!(%table_id, "table actor started");
    while let Some(cmd) = rx.recv().await {
        match cmd {
            TableCommand::Join { player_id, .. } => {
                info!(%table_id, %player_id, "player joined (stub)");
            }
            _ => {
                warn!(%table_id, "unhandled command: {:?}", cmd);
            }
        }
    }
    info!(%table_id, "table actor stopped");
}

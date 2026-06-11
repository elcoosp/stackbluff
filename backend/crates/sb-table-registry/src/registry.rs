use sb_contracts::{TableCommand, TableError};
use sb_shared_types::{PlayerId, TableConfig, TableId};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::{RwLock, broadcast, mpsc};
use tokio::time::{self, Duration, Instant};
use tracing::info;

type SenderMap = Arc<RwLock<HashMap<TableId, mpsc::Sender<TableCommand>>>>;
type HeartbeatMap = Arc<RwLock<HashMap<TableId, Instant>>>;

#[derive(Clone)]
pub struct Registry {
    senders: SenderMap,
    heartbeats: HeartbeatMap,
    shutdown_tx: broadcast::Sender<()>,
}

impl Registry {
    pub fn new() -> Self {
        let (shutdown_tx, _) = broadcast::channel(16);
        Self {
            senders: Arc::new(RwLock::new(HashMap::new())),
            heartbeats: Arc::new(RwLock::new(HashMap::new())),
            shutdown_tx,
        }
    }

    #[must_use]
    pub async fn create_table(&self, config: TableConfig) -> TableId {
        let table_id = TableId::new();
        let (tx, rx) = mpsc::channel(32);
        let heartbeats = self.heartbeats.clone();
        let shutdown_rx = self.shutdown_tx.subscribe();
        tokio::spawn(table_actor(table_id, rx, config, heartbeats, shutdown_rx));
        {
            let mut map = self.senders.write().await;
            map.insert(table_id, tx);
        }
        {
            let mut hb = self.heartbeats.write().await;
            hb.insert(table_id, Instant::now());
        }
        info!(%table_id, "table created");
        table_id
    }

    pub async fn join_table(
        &self,
        table_id: TableId,
        player_id: PlayerId,
    ) -> Result<(), TableError> {
        let sender = {
            let map = self.senders.read().await;
            map.get(&table_id).cloned()
        };
        let sender = sender.ok_or(TableError::NotFound(table_id))?;
        let (resp_tx, resp_rx) = tokio::sync::oneshot::channel();
        let cmd = TableCommand::Join {
            player_id,
            table_id,
            response_tx: resp_tx,
        };
        sender
            .send(cmd)
            .await
            .map_err(|_| TableError::ActorError("actor died".into()))?;
        resp_rx
            .await
            .map_err(|_| TableError::ActorError("no response".into()))?
    }

    pub async fn heartbeat(&self, table_id: TableId) {
        let mut hb = self.heartbeats.write().await;
        hb.insert(table_id, Instant::now());
    }

    pub async fn reaper_task(registry: Registry) {
        let mut interval = time::interval(Duration::from_secs(30));
        let mut shutdown_rx = registry.shutdown_tx.subscribe();
        loop {
            tokio::select! {
                _ = interval.tick() => {
                    let now = Instant::now();
                    let stale: Vec<TableId> = {
                        let hb = registry.heartbeats.read().await;
                        hb.iter()
                            .filter(|(_, last)| now.duration_since(**last) > Duration::from_secs(90))
                            .map(|(id, _)| *id)
                            .collect()
                    };
                    for table_id in stale {
                        info!(%table_id, "removing stale table (no heartbeat for 90s)");
                        {
                            let mut senders = registry.senders.write().await;
                            senders.remove(&table_id);
                        }
                        {
                            let mut hb = registry.heartbeats.write().await;
                            hb.remove(&table_id);
                        }
                    }
                }
                _ = shutdown_rx.recv() => {
                    info!("reaper received shutdown signal, exiting");
                    break;
                }
            }
        }
    }

    /// Gracefully shut down all table actors and the reaper.
    pub fn shutdown(&self) {
        let _ = self.shutdown_tx.send(());
    }

    /// Returns information about all currently active tables.
    pub async fn list_active_tables(&self) -> Vec<sb_contracts::lobby_api::TableInfo> {
        use sb_shared_types::StakeLevel;
        let senders = self.senders.read().await;
        let mut tables = Vec::with_capacity(senders.len());
        for &table_id in senders.keys() {
            tables.push(sb_contracts::lobby_api::TableInfo {
                table_id,
                stake_level: StakeLevel::Low,
                current_players: 0,
                max_players: 6,
                status: "active".to_string(),
            });
        }
        tables
    }
}

impl Default for Registry {
    fn default() -> Self {
        Self::new()
    }
}

async fn table_actor(
    table_id: TableId,
    mut rx: mpsc::Receiver<TableCommand>,
    _config: TableConfig,
    heartbeats: Arc<RwLock<HashMap<TableId, Instant>>>,
    mut shutdown_rx: broadcast::Receiver<()>,
) {
    info!(%table_id, "table actor started");
    loop {
        tokio::select! {
            Some(cmd) = rx.recv() => {
                match cmd {
                    TableCommand::Join { player_id, response_tx, .. } => {
                        info!(%table_id, %player_id, "player join request received (stub)");
                        let _ = response_tx.send(Ok(()));
                    }
                    TableCommand::Heartbeat { table_id: id } => {
                        let mut hb = heartbeats.write().await;
                        hb.insert(id, Instant::now());
                    }
                }
            }
            _ = shutdown_rx.recv() => {
                info!(%table_id, "table actor received shutdown signal, exiting");
                break;
            }
        }
    }
    info!(%table_id, "table actor stopped");
}

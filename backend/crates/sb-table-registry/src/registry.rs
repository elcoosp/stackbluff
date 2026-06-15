use crate::actor::{InternalCommand, spawn_table_actor};
use sb_contracts::{TableCommand, TableError, lobby_api::TableInfo};
use sb_game_engine::game_state::Action;
use sb_shared_types::{ChipAmount, TableConfig, TableId, UserId};
use sb_ws_handler::BroadcastSender;
use sb_ws_handler::broadcast_channel;
use sb_ws_messages::ServerMessage;
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::{RwLock, mpsc};
use uuid::Uuid;

type ActorSender = mpsc::Sender<InternalCommand>;

#[derive(Clone)]
struct TableEntry {
    cmd_tx: ActorSender,
    broadcast_tx: BroadcastSender<ServerMessage>,
}

#[derive(Clone)]
pub struct Registry {
    tables: Arc<RwLock<HashMap<TableId, TableEntry>>>,
    configs: Arc<RwLock<HashMap<TableId, TableConfig>>>,
    next_seat: Arc<RwLock<HashMap<TableId, u8>>>,
}

impl Registry {
    pub fn new() -> Self {
        Self {
            tables: Arc::new(RwLock::new(HashMap::new())),
            configs: Arc::new(RwLock::new(HashMap::new())),
            next_seat: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    pub async fn create_table(&self, config: TableConfig) -> TableId {
        let table_id = TableId::new(Uuid::new_v4());
        let (broadcast_tx, _) = broadcast_channel(32);
        let (cmd_tx, _) = spawn_table_actor(table_id, config.clone(), broadcast_tx.clone());
        let entry = TableEntry {
            cmd_tx,
            broadcast_tx: broadcast_tx.clone(),
        };
        self.tables.write().await.insert(table_id, entry);
        self.configs.write().await.insert(table_id, config);
        table_id
    }

    pub async fn subscribe_to_table(
        &self,
        table_id: TableId,
    ) -> Option<BroadcastSender<ServerMessage>> {
        self.tables
            .read()
            .await
            .get(&table_id)
            .map(|entry| entry.broadcast_tx.clone())
    }

    pub async fn send_action(
        &self,
        _table_id: TableId,
        _user_id: UserId,
        _action: Action,
    ) -> Result<(), TableError> {
        // TODO: implement properly after game engine integration
        Ok(())
    }

    pub async fn join_table_full(
        &self,
        table_id: TableId,
        user_id: UserId,
        seat: u8,
        stack: ChipAmount,
    ) -> Result<(), TableError> {
        let guard = self.tables.read().await;
        let entry = guard.get(&table_id).ok_or(TableError::NotFound(table_id))?;
        let cmd = InternalCommand::Join {
            user_id,
            seat,
            stack,
        };
        entry
            .cmd_tx
            .send(cmd)
            .await
            .map_err(|_| TableError::ActorError("actor dropped".into()))
    }

    pub async fn send_leave(&self, table_id: TableId, user_id: UserId) -> Result<(), TableError> {
        let guard = self.tables.read().await;
        let entry = guard.get(&table_id).ok_or(TableError::NotFound(table_id))?;
        let cmd = InternalCommand::Leave { user_id };
        entry
            .cmd_tx
            .send(cmd)
            .await
            .map_err(|_| TableError::ActorError("actor dropped".into()))
    }

    pub async fn list_active_tables(&self) -> Vec<TableInfo> {
        let configs = self.configs.read().await;
        configs
            .iter()
            .map(|(id, cfg)| TableInfo {
                table_id: *id,
                name: format!("{} Table", cfg.stake_level),
                stake_level: cfg.stake_level,
                max_players: cfg.max_players as u32,
                current_players: 0,
                status: "active".to_string(),
            })            .collect()
    }

    async fn get_sender(&self, id: TableId) -> Option<ActorSender> {
        self.tables
            .read()
            .await
            .get(&id)
            .map(|entry| entry.cmd_tx.clone())
    }

    pub async fn send_command(
        &self,
        table_id: TableId,
        cmd: TableCommand,
    ) -> Result<(), TableError> {
        match cmd {
            TableCommand::Join {
                table_id: _,
                user_id,
                reply_to,
            } => {
                let stack = ChipAmount::new(1000).unwrap(); // fallback – contract lacks stack
                let seat = {
                    let mut seats = self.next_seat.write().await;
                    let s = seats.entry(table_id).or_insert(0);
                    let val = *s;
                    *s = (val + 1) % 6;
                    val
                };
                let sender = self
                    .get_sender(table_id)
                    .await
                    .ok_or(TableError::NotFound(table_id))?;
                let internal = InternalCommand::Join {
                    user_id,
                    seat,
                    stack,
                };
                match sender.send(internal).await {
                    Ok(()) => {
                        let _ = reply_to.send(Ok(()));
                        Ok(())
                    }
                    Err(e) => {
                        let msg = format!("send failed: {}", e);
                        let _ = reply_to.send(Err(TableError::ActorError(msg.clone())));
                        Err(TableError::ActorError(msg))
                    }
                }
            }
            TableCommand::Heartbeat { table_id: _ } => Ok(()),
            _ => Err(TableError::Internal("Unsupported command".into())),
        }
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

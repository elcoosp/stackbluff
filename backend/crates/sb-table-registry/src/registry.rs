use crate::actor::{InternalCommand, spawn_table_actor};
use crate::events::HandCompletedEvent;
use sb_contracts::{TableCommand, TableError, lobby_api::TableInfo};
use sb_game_engine::game_state::Action;
use sb_shared_types::{ActionType, ChipAmount, TableConfig, TableId, UserId};

use crate::game_room::{BroadcastSender, broadcast_channel};
use std::collections::{HashMap, HashSet};
use std::sync::Arc;
use tokio::sync::{RwLock, mpsc};
use uuid::Uuid;

type ActorSender = mpsc::Sender<InternalCommand>;

#[derive(Clone)]
struct TableEntry {
    cmd_tx: ActorSender,
    broadcast_tx: BroadcastSender,
}

#[derive(Clone)]
pub struct Registry {
    tables: Arc<RwLock<HashMap<TableId, TableEntry>>>,
    configs: Arc<RwLock<HashMap<TableId, TableConfig>>>,
    next_seat: Arc<RwLock<HashMap<TableId, u8>>>,
    users_at_table: Arc<RwLock<HashMap<TableId, HashSet<UserId>>>>,
    event_tx: tokio::sync::broadcast::Sender<HandCompletedEvent>,
}

impl Registry {
    pub fn new() -> Self {
        let (event_tx, _) = tokio::sync::broadcast::channel(64);
        Self {
            tables: Arc::new(RwLock::new(HashMap::new())),
            configs: Arc::new(RwLock::new(HashMap::new())),
            next_seat: Arc::new(RwLock::new(HashMap::new())),
            users_at_table: Arc::new(RwLock::new(HashMap::new())),
            event_tx,
        }
    }

    pub async fn create_table(&self, config: TableConfig) -> TableId {
        let table_id = TableId::new(Uuid::new_v4());
        let broadcast_tx: BroadcastSender = broadcast_channel(256);
        let (cmd_tx, _) = spawn_table_actor(
            table_id,
            config.clone(),
            broadcast_tx.clone(),
            self.event_tx.clone(),
        );
        let entry = TableEntry {
            cmd_tx,
            broadcast_tx: broadcast_tx.clone(),
        };
        self.tables.write().await.insert(table_id, entry);
        self.configs.write().await.insert(table_id, config);
        table_id
    }

    pub async fn register_existing_table(&self, table_id: TableId, config: TableConfig) {
        if self.tables.read().await.contains_key(&table_id) {
            tracing::debug!(%table_id, "Table already registered, skipping");
            return;
        }
        let broadcast_tx: BroadcastSender = broadcast_channel(256);
        let (cmd_tx, _) = spawn_table_actor(
            table_id,
            config.clone(),
            broadcast_tx.clone(),
            self.event_tx.clone(),
        );
        let entry = TableEntry {
            cmd_tx,
            broadcast_tx: broadcast_tx.clone(),
        };
        self.tables.write().await.insert(table_id, entry);
        self.configs.write().await.insert(table_id, config);
        tracing::info!(%table_id, "Registered existing table in Registry");
    }

    pub async fn subscribe_to_table(&self, table_id: TableId) -> Option<BroadcastSender> {
        self.tables
            .read()
            .await
            .get(&table_id)
            .map(|entry| entry.broadcast_tx.clone())
    }

    pub async fn get_table_config(&self, table_id: TableId) -> Option<TableConfig> {
        self.configs.read().await.get(&table_id).cloned()
    }

    pub async fn send_action(
        &self,
        _table_id: TableId,
        _user_id: UserId,
        _action: Action,
    ) -> Result<(), TableError> {
        Ok(())
    }

    pub async fn join_table_full(
        &self,
        table_id: TableId,
        user_id: UserId,
        display_name: String,
        seat: Option<u8>,
        stack: ChipAmount,
    ) -> Result<(), TableError> {
        let guard = self.tables.read().await;
        let entry = guard.get(&table_id).ok_or(TableError::NotFound(table_id))?;
        let cmd = InternalCommand::Join {
            user_id,
            display_name,
            seat,
            stack,
        };
        entry
            .cmd_tx
            .send(cmd)
            .await
            .map_err(|_| TableError::ActorError("actor dropped".into()))?;

        self.add_user_to_table(table_id, user_id).await;

        Ok(())
    }

    pub async fn send_reconnect(
        &self,
        table_id: TableId,
        user_id: UserId,
    ) -> Result<(), TableError> {
        let guard = self.tables.read().await;
        let entry = guard.get(&table_id).ok_or(TableError::NotFound(table_id))?;
        let cmd = InternalCommand::Reconnect { user_id };
        entry
            .cmd_tx
            .send(cmd)
            .await
            .map_err(|_| TableError::ActorError("actor dropped".into()))
    }

    pub async fn send_leave(
        &self,
        table_id: TableId,
        user_id: UserId,
    ) -> Result<ChipAmount, TableError> {
        let guard = self.tables.read().await;
        let entry = guard.get(&table_id).ok_or(TableError::NotFound(table_id))?;

        let (tx, rx) = tokio::sync::oneshot::channel();
        let cmd = InternalCommand::Leave {
            user_id,
            respond_to: tx,
        };

        entry
            .cmd_tx
            .send(cmd)
            .await
            .map_err(|_| TableError::ActorError("actor dropped".into()))?;

        let result = rx
            .await
            .map_err(|_| TableError::ActorError("actor dropped".into()));

        self.remove_user_from_table(table_id, user_id).await;

        result
    }

    pub async fn send_rebuy(
        &self,
        table_id: TableId,
        user_id: UserId,
        stack: ChipAmount,
    ) -> Result<(), TableError> {
        let guard = self.tables.read().await;
        let entry = guard.get(&table_id).ok_or(TableError::NotFound(table_id))?;
        let cmd = InternalCommand::Rebuy { user_id, stack };
        entry
            .cmd_tx
            .send(cmd)
            .await
            .map_err(|_| TableError::ActorError("actor dropped".into()))
    }

    pub async fn send_player_action(
        &self,
        table_id: TableId,
        user_id: UserId,
        action_type: ActionType,
        amount: Option<ChipAmount>,
    ) -> Result<(), TableError> {
        let guard = self.tables.read().await;
        let entry = guard.get(&table_id).ok_or(TableError::NotFound(table_id))?;
        let cmd = InternalCommand::Action {
            user_id,
            action_type,
            amount,
        };
        entry
            .cmd_tx
            .send(cmd)
            .await
            .map_err(|_| TableError::ActorError("actor dropped".into()))
    }

    pub async fn start_hand(&self, table_id: TableId) -> Result<(), TableError> {
        let guard = self.tables.read().await;
        let entry = guard.get(&table_id).ok_or(TableError::NotFound(table_id))?;
        entry
            .cmd_tx
            .send(InternalCommand::StartHand)
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
            })
            .collect()
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
                let stack = ChipAmount::new(1000).unwrap();
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
                    display_name: "Player".to_string(),
                    seat: Some(seat),
                    stack,
                };
                match sender.send(internal).await {
                    Ok(()) => {
                        self.add_user_to_table(table_id, user_id).await;
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

    pub async fn add_user_to_table(&self, table_id: TableId, user_id: UserId) {
        let mut map = self.users_at_table.write().await;
        map.entry(table_id)
            .or_insert_with(HashSet::new)
            .insert(user_id);
    }

    pub async fn remove_user_from_table(&self, table_id: TableId, user_id: UserId) {
        let mut map = self.users_at_table.write().await;
        if let Some(set) = map.get_mut(&table_id) {
            set.remove(&user_id);
            if set.is_empty() {
                map.remove(&table_id);
            }
        }
    }

    pub async fn is_user_at_table(&self, table_id: TableId, user_id: UserId) -> bool {
        self.users_at_table
            .read()
            .await
            .get(&table_id)
            .map(|set| set.contains(&user_id))
            .unwrap_or(false)
    }

    pub fn event_sender(&self) -> tokio::sync::broadcast::Sender<HandCompletedEvent> {
        self.event_tx.clone()
    }
}

impl Default for Registry {
    fn default() -> Self {
        Self::new()
    }
}

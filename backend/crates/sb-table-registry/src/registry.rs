#![allow(unused_imports)]
use crate::TableActorConfig;
use crate::actor::{InternalCommand, LeaveResult, spawn_table_actor};
use crate::connection_broker::ConnectionBroker;
use crate::events::TableEvent;
use crate::game_room::RoomMessage;
use sb_contracts::stats_api::PlayerStatsRepo;
use sb_contracts::{TableCommand, TableError, lobby_api::TableInfo};
use sb_shared_types::AppError;
use sb_shared_types::{ActionType, ChipAmount, TableConfig, TableId, UserId};
use uuid::Uuid;

use std::collections::{HashMap, HashSet};
use std::sync::Arc;
use std::sync::atomic::{AtomicU8, Ordering};
use std::time::Duration;
use tokio::sync::{RwLock, mpsc};
use tracing::info;
use sb_shared_types::GameVariant;
use sb_shared_types::RequestContext;
use crate::actor::buy_in_limits_for_stake;

type ActorSender = mpsc::Sender<InternalCommand>;

#[derive(Clone)]
struct RoomEntry {
    table_id: TableId,
    cmd_tx: ActorSender,
    active_players: Arc<AtomicU8>,
    #[allow(dead_code)]
    is_tournament: bool,
}

#[derive(Clone)]
pub struct Registry {
    table_configs: Arc<RwLock<HashMap<TableId, TableConfig>>>,
    table_creators: Arc<RwLock<HashMap<TableId, UserId>>>,
    table_chat_ids: Arc<RwLock<HashMap<TableId, Option<String>>>>,
    table_rooms: Arc<RwLock<HashMap<TableId, Vec<TableId>>>>,
    rooms: Arc<RwLock<HashMap<TableId, RoomEntry>>>,
    users_at_table: Arc<RwLock<HashMap<TableId, HashSet<UserId>>>>,
    user_room_map: Arc<RwLock<HashMap<UserId, HashSet<TableId>>>>,
    event_tx: tokio::sync::broadcast::Sender<TableEvent>,
    stats_repo: Arc<dyn PlayerStatsRepo + Send + Sync>,
    #[allow(clippy::type_complexity)]
    table_metadata: Arc<RwLock<HashMap<TableId, (UserId, Option<String>)>>>,
}

impl Registry {
    pub fn new(stats_repo: Arc<dyn PlayerStatsRepo + Send + Sync>) -> Self {
        let (event_tx, _) = tokio::sync::broadcast::channel(1024);
        Self {
            table_configs: Arc::new(RwLock::new(HashMap::new())),
            table_creators: Arc::new(RwLock::new(HashMap::new())),
            table_chat_ids: Arc::new(RwLock::new(HashMap::new())),
            table_rooms: Arc::new(RwLock::new(HashMap::new())),
            rooms: Arc::new(RwLock::new(HashMap::new())),
            users_at_table: Arc::new(RwLock::new(HashMap::new())),
            user_room_map: Arc::new(RwLock::new(HashMap::new())),
            event_tx,
            stats_repo,
            table_metadata: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    pub async fn create_table(
        &self,
        config: TableConfig,
        created_by: UserId,
        chat_id: Option<String>,
    ) -> TableId {
        let table_id = TableId::new(uuid::Uuid::new_v4());
        self.register_existing_table(table_id, config, created_by, chat_id)
            .await;
        table_id
    }

    pub async fn register_existing_table(
        &self,
        table_id: TableId,
        config: TableConfig,
        created_by: UserId,
        chat_id: Option<String>,
    ) {
        if self.table_configs.read().await.contains_key(&table_id) {
            return;
        }
        self.table_configs.write().await.insert(table_id, config);
        self.table_creators
            .write()
            .await
            .insert(table_id, created_by);

        self.table_chat_ids
            .write()
            .await
            .insert(table_id, chat_id.clone());
        self.table_rooms.write().await.entry(table_id).or_default();
        self.table_metadata
            .write()
            .await
            .insert(table_id, (created_by, chat_id));
        info!(%table_id, "Registered table config in Registry");
    }

    pub async fn assign_room(
        &self,
        table_id: TableId,
        exclude_rooms: Vec<TableId>,
    ) -> Result<TableId, TableError> {
        let config = self
            .table_configs
            .read()
            .await
            .get(&table_id)
            .ok_or(TableError::NotFound(table_id))?
            .clone();

        let mut table_rooms = self.table_rooms.write().await;
        let mut rooms = self.rooms.write().await;

        if let Some(room_ids) = table_rooms.get(&table_id) {
            for room_id in room_ids {
                if !exclude_rooms.contains(room_id)
                    && let Some(room) = rooms.get(room_id)
                    && room.active_players.load(Ordering::Relaxed) < config.max_players
                {
                    return Ok(*room_id);
                }
            }
        }

        let new_room_id = TableId::new(uuid::Uuid::new_v4());
        let active_players = Arc::new(AtomicU8::new(0));

        let (created_by, chat_id) = self
            .table_metadata
            .read()
            .await
            .get(&table_id)
            .cloned()
            .unwrap_or_else(|| (UserId::new(uuid::Uuid::nil()), None));

        let (cmd_tx, _) = spawn_table_actor(TableActorConfig {
            room_id: new_room_id,
            table_id,
            config: config.clone(),
            event_tx: self.event_tx.clone(),
            stats_repo: self.stats_repo.clone(),
            active_players: active_players.clone(),
            created_by,
            chat_id,
        });

        let room_entry = RoomEntry {
            table_id,
            cmd_tx,
            active_players,
            is_tournament: false,
        };

        rooms.insert(new_room_id, room_entry);
        table_rooms.entry(table_id).or_default().push(new_room_id);

        Ok(new_room_id)
    }

    pub async fn find_all_user_rooms(&self, user_id: UserId) -> Vec<TableId> {
        self.user_room_map
            .read()
            .await
            .get(&user_id)
            .map(|set| set.iter().cloned().collect())
            .unwrap_or_default()
    }

    pub async fn get_table_config(&self, table_id: TableId) -> Option<TableConfig> {
        self.table_configs.read().await.get(&table_id).cloned()
    }

    pub async fn join_room_full(
        &self,
        room_id: TableId,
        user_id: UserId,
        display_name: String,
        seat: Option<u8>,
        stack: ChipAmount,
        msg_tx: mpsc::UnboundedSender<RoomMessage>,
        is_bot: bool,
    ) -> Result<bool, TableError> {
        let table_id = {
            let guard = self.rooms.read().await;
            let entry = guard.get(&room_id).ok_or(TableError::NotFound(room_id))?;
            entry.table_id
        };

        let (tx, rx) = tokio::sync::oneshot::channel();

        let cmd_tx = {
            let guard = self.rooms.read().await;
            let entry = guard.get(&room_id).ok_or(TableError::NotFound(room_id))?;
            entry.cmd_tx.clone()
        };

        let cmd = InternalCommand::Join {
            user_id,
            display_name,
            seat,
            stack,
            msg_tx,
            is_bot,
            respond_to: tx,
        };

        tokio::time::timeout(Duration::from_secs(5), cmd_tx.send(cmd))
            .await
            .map_err(|_| TableError::ActorError("timeout sending Join".to_string()))?
            .map_err(|_| TableError::ActorError("actor dropped".to_string()))?;

        let is_new_join = tokio::time::timeout(Duration::from_secs(10), rx)
            .await
            .map_err(|_| TableError::ActorError("timeout waiting for Join response".to_string()))?
            .map_err(|_| TableError::ActorError("actor dropped".to_string()))?;

        if is_new_join {
            self.user_room_map
                .write()
                .await
                .entry(user_id)
                .or_default()
                .insert(room_id);
            self.add_user_to_table(table_id, user_id).await;
        }

        Ok(is_new_join)
    }

    pub async fn send_reconnect(
        &self,
        room_id: TableId,
        user_id: UserId,
        msg_tx: mpsc::UnboundedSender<RoomMessage>,
    ) -> Result<bool, TableError> {
        let (tx, rx) = tokio::sync::oneshot::channel();

        let cmd_tx = {
            let guard = self.rooms.read().await;
            let entry = guard.get(&room_id).ok_or(TableError::NotFound(room_id))?;
            entry.cmd_tx.clone()
        };

        let cmd = InternalCommand::Reconnect {
            user_id,
            msg_tx,
            respond_to: tx,
        };

        tokio::time::timeout(Duration::from_secs(5), cmd_tx.send(cmd))
            .await
            .map_err(|_| TableError::ActorError("timeout sending Reconnect".to_string()))?
            .map_err(|_| TableError::ActorError("actor dropped".to_string()))?;

        let found = tokio::time::timeout(Duration::from_secs(10), rx)
            .await
            .map_err(|_| {
                TableError::ActorError("timeout waiting for Reconnect response".to_string())
            })?
            .map_err(|_| TableError::ActorError("actor dropped".to_string()))?;

        if !found {
            let mut map = self.user_room_map.write().await;
            if let Some(set) = map.get_mut(&user_id) {
                set.remove(&room_id);
                if set.is_empty() {
                    map.remove(&user_id);
                }
            }
        }

        Ok(found)
    }

    pub async fn send_leave(
        &self,
        room_id: TableId,
        user_id: UserId,
        force: bool,
    ) -> Result<ChipAmount, TableError> {
        let table_id = {
            let guard = self.rooms.read().await;
            let entry = guard.get(&room_id).ok_or(TableError::NotFound(room_id))?;
            entry.table_id
        };

        let (tx, rx) = tokio::sync::oneshot::channel();
        let cmd = InternalCommand::Leave {
            user_id,
            respond_to: tx,
            force,
        };

        let cmd_tx = {
            let guard = self.rooms.read().await;
            let entry = guard.get(&room_id).ok_or(TableError::NotFound(room_id))?;
            entry.cmd_tx.clone()
        };

        tokio::time::timeout(Duration::from_secs(5), cmd_tx.send(cmd))
            .await
            .map_err(|_| TableError::ActorError("timeout sending Leave".to_string()))?
            .map_err(|_| TableError::ActorError("actor dropped".to_string()))?;

        let result = tokio::time::timeout(Duration::from_secs(15), rx)
            .await
            .map_err(|_| TableError::ActorError("timeout waiting for Leave response".to_string()))?
            .map_err(|_| TableError::ActorError("actor dropped".to_string()));

        match result {
            Ok(LeaveResult::Refunded(stack)) => {
                let mut map = self.user_room_map.write().await;
                if let Some(set) = map.get_mut(&user_id) {
                    set.remove(&room_id);
                    if set.is_empty() {
                        map.remove(&user_id);
                    }
                }
                drop(map);

                self.remove_user_from_table(table_id, user_id).await;
                Ok(stack)
            }
            Ok(LeaveResult::Cancelled) => Ok(ChipAmount::new(0).unwrap()),
            Err(e) => Err(e),
        }
    }

    pub async fn send_rebuy(
        &self,
        room_id: TableId,
        user_id: UserId,
        stack: ChipAmount,
    ) -> Result<(), TableError> {
        let cmd_tx = {
            let guard = self.rooms.read().await;
            let entry = guard.get(&room_id).ok_or(TableError::NotFound(room_id))?;
            entry.cmd_tx.clone()
        };
        let cmd = InternalCommand::Rebuy { user_id, stack };
        cmd_tx
            .send(cmd)
            .await
            .map_err(|e| TableError::ActorError(e.to_string()))
    }

    pub async fn send_player_action(
        &self,
        room_id: TableId,
        user_id: UserId,
        action_type: ActionType,
        amount: Option<ChipAmount>,
    ) -> Result<(), TableError> {
        let cmd_tx = {
            let guard = self.rooms.read().await;
            let entry = guard.get(&room_id).ok_or(TableError::NotFound(room_id))?;
            entry.cmd_tx.clone()
        };
        let cmd = InternalCommand::Action {
            user_id,
            action_type,
            amount,
        };
        cmd_tx
            .send(cmd)
            .await
            .map_err(|e| TableError::ActorError(e.to_string()))
    }

    pub async fn start_hand(&self, room_id: TableId) -> Result<(), TableError> {
        let cmd_tx = {
            let guard = self.rooms.read().await;
            let entry = guard.get(&room_id).ok_or(TableError::NotFound(room_id))?;
            entry.cmd_tx.clone()
        };
        cmd_tx
            .send(InternalCommand::StartHand)
            .await
            .map_err(|e| TableError::ActorError(e.to_string()))
    }

    pub async fn get_total_active_players(&self, table_id: TableId) -> u32 {
        let room_ids = self
            .table_rooms
            .read()
            .await
            .get(&table_id)
            .cloned()
            .unwrap_or_default();
        let rooms = self.rooms.read().await;
        let mut total = 0;
        for room_id in &room_ids {
            if let Some(room) = rooms.get(room_id) {
                total += room.active_players.load(Ordering::Relaxed) as u32;
            }
        }
        total
    }

    pub async fn list_active_tables(&self) -> Vec<TableInfo> {
        let configs = self.table_configs.read().await.clone();
        let mut result = Vec::new();
        for (id, cfg) in configs {
            let active_players = self.get_total_active_players(id).await;
            result.push(TableInfo {
                table_id: id,
                name: format!("{} Table", cfg.stake_level),
                stake_level: cfg.stake_level,
                max_players: cfg.max_players as u32,
                current_players: active_players,
                status: "active".to_string(),
            });
        }
        result
    }

    #[allow(unused_variables)]
    #[allow(unused_variables)]
    pub async fn send_command(
        &self,
        room_id: TableId,
        cmd: TableCommand,
    ) -> Result<(), TableError> {
        match cmd {
            TableCommand::CreateTable { table_id, stake_level, max_players, reply_to } => {
                let (min_buy_in, max_buy_in) = crate::actor::buy_in_limits_for_stake(stake_level);
                let config = TableConfig {
                    max_players: max_players as u8,
                    stake_level,
                    variant: GameVariant::Holdem,
                    min_buy_in,
                    max_buy_in,
                    turn_time_limit_ms: 30000,
                };
                self.register_existing_table(table_id, config, UserId::new(uuid::Uuid::nil()), None).await;
                let _ = reply_to.send(Ok(()));
                Ok(())
            }
            TableCommand::RemoveTable { table_id, reply_to } => {
                self.remove_room(table_id).await;
                let _ = reply_to.send(Ok(()));
                Ok(())
            }
            TableCommand::GetTableInfo { table_id, reply_to } => {
                let config_opt = self.table_configs.read().await.get(&table_id).cloned();
                let active = self.get_total_active_players(table_id).await;
                let info = config_opt.map(|c| TableInfo {
                    table_id,
                    name: format!("{:?} Table", c.stake_level),
                    stake_level: c.stake_level,
                    current_players: active,
                    max_players: c.max_players as u32,
                    status: "active".to_string(),
                });
                let _ = reply_to.send(info.ok_or(TableError::NotFound(table_id)));
                Ok(())
            }
            TableCommand::ListTables { reply_to } => {
                let tables = self.list_active_tables().await;
                let _ = reply_to.send(Ok(tables));
                Ok(())
            }
            TableCommand::Join { table_id, user_id, reply_to } => {
                let rooms = self.find_all_user_rooms(user_id).await;
                match self.assign_room(table_id, rooms).await {
                    Ok(room_id) => {
                        let (msg_tx, _) = tokio::sync::mpsc::unbounded_channel();
                        let stack = ChipAmount::new(1000).unwrap();
                        let _ = self.join_room_full(room_id, user_id, "Player".to_string(), None, stack, msg_tx, false).await;
                        let _ = reply_to.send(Ok(()));
                    }
                    Err(e) => {
                        let _ = reply_to.send(Err(e));
                    }
                }
                Ok(())
            }
            TableCommand::Heartbeat { table_id: _ } => {
                Ok(())
            }
        }
    }

    pub async fn add_user_to_table(&self, table_id: TableId, user_id: UserId) {
        self.users_at_table
            .write()
            .await
            .entry(table_id)
            .or_default()
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

    pub fn event_sender(&self) -> tokio::sync::broadcast::Sender<TableEvent> {
        self.event_tx.clone()
    }

    // 5-arg version (backward compatible wrapper)
    pub async fn create_tournament_table(
        &self,
        config: TableConfig,
        tournament_id: sb_shared_types::TournamentId,
        broker: Arc<ConnectionBroker>,
        created_by: UserId,
        chat_id: Option<String>,
    ) -> Result<(mpsc::Sender<InternalCommand>, TableId), AppError> {
        self.create_tournament_table_with_metadata(
            config,
            tournament_id,
            broker,
            created_by,
            chat_id,
        )
        .await
    }

    // 5-arg version with metadata
    pub async fn create_tournament_table_with_metadata(
        &self,
        config: TableConfig,
        tournament_id: sb_shared_types::TournamentId,
        broker: Arc<ConnectionBroker>,
        created_by: UserId,
        chat_id: Option<String>,
    ) -> Result<(mpsc::Sender<InternalCommand>, TableId), AppError> {
        let room_id = TableId::new(uuid::Uuid::new_v4());
        let active_players = Arc::new(AtomicU8::new(0));

        let (cmd_tx, _) = spawn_table_actor(TableActorConfig {
            room_id,
            table_id: room_id,
            config: config.clone(),
            event_tx: self.event_tx.clone(),
            stats_repo: self.stats_repo.clone(),
            active_players: active_players.clone(),
            created_by,
            chat_id,
        });

        cmd_tx
            .send(InternalCommand::EnterTournamentMode {
                parent: tournament_id,
                broker: broker.clone(),
            })
            .await
            .map_err(|_| AppError::Internal("table actor dropped".to_string()))?;

        let room_entry = RoomEntry {
            table_id: room_id,
            cmd_tx: cmd_tx.clone(),
            active_players,
            is_tournament: true,
        };

        self.rooms.write().await.insert(room_id, room_entry);
        self.table_rooms
            .write()
            .await
            .entry(room_id)
            .or_default()
            .push(room_id);

        info!(%room_id, %tournament_id, "Tournament table created");
        Ok((cmd_tx, room_id))
    }

    /// Remove a room from the registry.
    pub async fn remove_room(&self, room_id: TableId) {
        if let Some(entry) = self.rooms.write().await.remove(&room_id) {
            let _ = entry.cmd_tx.send(InternalCommand::Shutdown).await;
        }
        let mut table_rooms = self.table_rooms.write().await;
        for room_ids in table_rooms.values_mut() {
            room_ids.retain(|id| *id != room_id);
        }
        info!(%room_id, "Room removed from registry");
    }

    pub async fn spawn_room_reaper(registry: Arc<Registry>) {
        tokio::spawn(async move {
            let mut interval = tokio::time::interval(Duration::from_secs(60));
            loop {
                interval.tick().await;
                let mut rooms_to_remove = Vec::new();
                let rooms = registry.rooms.read().await;
                for (room_id, entry) in rooms.iter() {
                    // Only reap non-tournament empty rooms
                    if entry.active_players.load(Ordering::Relaxed) == 0 && !entry.is_tournament {
                        rooms_to_remove.push(*room_id);
                    }
                }
                drop(rooms);

                for room_id in rooms_to_remove {
                    let cmd_tx_opt = {
                        let guard = registry.rooms.read().await;
                        guard.get(&room_id).map(|e| e.cmd_tx.clone())
                    };

                    if let Some(cmd_tx) = cmd_tx_opt {
                        let _ = cmd_tx.send(InternalCommand::Shutdown).await;
                    }

                    registry.rooms.write().await.remove(&room_id);
                    let mut table_rooms = registry.table_rooms.write().await;
                    for (_, room_ids) in table_rooms.iter_mut() {
                        room_ids.retain(|id| *id != room_id);
                    }
                    info!(%room_id, "Reaped empty room");
                }
            }
        });
    }

    pub async fn start_kick_vote(
        &self,
        room_id: TableId,
        initiator_id: UserId,
        target_id: UserId,
        respond_to: Option<tokio::sync::oneshot::Sender<ChipAmount>>,
    ) -> Result<(), AppError> {
        let rooms = self.rooms.read().await;
        let actor = rooms
            .get(&room_id)
            .ok_or(AppError::Internal("table actor not found".to_string()))?;
        actor
            .cmd_tx
            .send(InternalCommand::StartKickVote {
                initiator_id,
                target_id,
                respond_to,
            })
            .await
            .map_err(|_| AppError::Internal("table actor disconnected".to_string()))?;
        Ok(())
    }

    pub async fn vote_kick_yes(
        &self,
        room_id: TableId,
        voter_id: UserId,
        kick_vote_id: Uuid,
    ) -> Result<(), AppError> {
        let rooms = self.rooms.read().await;
        let actor = rooms
            .get(&room_id)
            .ok_or(AppError::Internal("table actor not found".to_string()))?;
        actor
            .cmd_tx
            .send(InternalCommand::VoteKickYes {
                voter_id,
                kick_vote_id,
            })
            .await
            .map_err(|_| AppError::Internal("table actor disconnected".to_string()))?;
        Ok(())
    }

    /// Subscribe a user to a room's broadcast (for spectating).
    pub async fn subscribe_to_room(&self, room_id: TableId, user_id: UserId) {
        self.user_room_map
            .write()
            .await
            .entry(user_id)
            .or_default()
            .insert(room_id);
    }

    /// Remove a user from a room's broadcast.
    pub async fn unsubscribe_from_room(&self, room_id: TableId, user_id: UserId) {
        if let Some(set) = self.user_room_map.write().await.get_mut(&user_id) {
            set.remove(&room_id);
            if set.is_empty() {
                self.user_room_map.write().await.remove(&user_id);
            }
        }
    }

    pub async fn set_sitting_out(
        &self,
        room_id: TableId,
        user_id: UserId,
        sitting_out: bool,
    ) -> Result<(), AppError> {
        let rooms = self.rooms.read().await;
        let actor = rooms
            .get(&room_id)
            .ok_or(AppError::Internal("table actor not found".to_string()))?;
        actor
            .cmd_tx
            .send(InternalCommand::SitOut {
                user_id,
                sitting_out,
            })
            .await
            .map_err(|_| AppError::Internal("table actor disconnected".to_string()))?;
        Ok(())
    }
}

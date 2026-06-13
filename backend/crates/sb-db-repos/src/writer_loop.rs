use sea_orm::{ConnectionTrait, DatabaseConnection, TransactionTrait};
use tokio::sync::mpsc;
use tokio::sync::watch;
use tracing::{Instrument, error, info, info_span};

use crate::commands::DbCommand;
use sb_contracts::PersistenceError;

const DEFAULT_BATCH_SIZE: usize = 50;

pub struct WriterLoopHandle {
    pub sender: mpsc::UnboundedSender<DbCommand>,
    pub shutdown: watch::Sender<bool>,
    pub task: tokio::task::JoinHandle<()>,
}

pub fn init_writer_loop(db: DatabaseConnection, batch_size: Option<usize>) -> WriterLoopHandle {
    let (tx, rx) = mpsc::unbounded_channel();
    let (shutdown_tx, shutdown_rx) = watch::channel(false);
    let size = batch_size.unwrap_or(DEFAULT_BATCH_SIZE);
    let handle = tokio::spawn(writer_loop(rx, db, shutdown_rx, size));
    WriterLoopHandle {
        sender: tx,
        shutdown: shutdown_tx,
        task: handle,
    }
}

async fn writer_loop(
    mut rx: mpsc::UnboundedReceiver<DbCommand>,
    db: DatabaseConnection,
    mut shutdown_rx: watch::Receiver<bool>,
    batch_size: usize,
) {
    let mut batch = Vec::with_capacity(batch_size);
    loop {
        tokio::select! {
            cmd = rx.recv() => {
                match cmd {
                    Some(cmd) => {
                        batch.push(cmd);
                        if batch.len() >= batch_size {
                            process_batch(&mut batch, &db).await;
                        }
                    }
                    None => {
                        if !batch.is_empty() {
                            process_batch(&mut batch, &db).await;
                        }
                        break;
                    }
                }
            }
            _ = shutdown_rx.changed() => {
                if *shutdown_rx.borrow() {
                    info!("Shutdown signal received, processing remaining {} commands", batch.len());
                    if !batch.is_empty() {
                        process_batch(&mut batch, &db).await;
                    }
                    break;
                }
            }
            else => {
                if !batch.is_empty() {
                    process_batch(&mut batch, &db).await;
                }
            }
        }
    }
    info!("Writer loop terminated");
}

async fn process_batch(batch: &mut Vec<DbCommand>, db: &DatabaseConnection) {
    let txn = match db.begin().await {
        Ok(txn) => txn,
        Err(e) => {
            error!("Failed to begin transaction: {}", e);
            for cmd in batch.drain(..) {
                respond_err(cmd, PersistenceError::Transient(e.to_string()));
            }
            return;
        }
    };

    let mut savepoint_results = Vec::with_capacity(batch.len());
    for (idx, cmd) in batch.iter_mut().enumerate() {
        let sp_name = format!("sp_{}", idx);
        let result = run_command_in_savepoint(cmd, &txn, &sp_name).await;
        savepoint_results.push(result);
    }

    if let Err(e) = txn.commit().await {
        error!("Transaction commit failed: {}", e);
        for (cmd, _) in batch.drain(..).zip(savepoint_results) {
            respond_err(cmd, PersistenceError::Transient(e.to_string()));
        }
    } else {
        for (cmd, result) in batch.drain(..).zip(savepoint_results) {
            match result {
                Ok(res) => respond_ok(cmd, res),
                Err(err) => respond_err(cmd, err),
            }
        }
    }
}

async fn run_command_in_savepoint<C: ConnectionTrait>(
    cmd: &mut DbCommand,
    conn: &C,
    sp_name: &str,
) -> Result<Option<String>, PersistenceError> {
    let ctx = match cmd {
        DbCommand::CreateUser { ctx, .. } => ctx,
        DbCommand::GetUser { ctx, .. } => ctx,
        DbCommand::UpdateChipBalance { ctx, .. } => ctx,
        DbCommand::StoreHandHistory { ctx, .. } => ctx,
        DbCommand::ExecuteRaw { ctx, .. } => ctx,
    };
    let request_id = ctx.request_id;
    let span = info_span!("db_command", savepoint = sp_name, request_id = %request_id);
    async {
        let create_sql = format!("SAVEPOINT {}", sp_name);
        if let Err(e) = conn.execute_unprepared(&create_sql).await {
            return Err(PersistenceError::Transient(e.to_string()));
        }

        let result = match cmd {
            DbCommand::CreateUser {
                telegram_id,
                email,
                display_name,
                ..
            } => {
                use sb_db_entities::user::ActiveModel;
                use sea_orm::{ActiveModelTrait, Set};
                let new_user = ActiveModel {
                    id: Set(uuid::Uuid::new_v4()),
                    telegram_id: Set(Some(*telegram_id)),
                    email: Set(Some(email.clone())),
                    display_name: Set(display_name.clone()),
                    streak_count: Set(0),
                    created_at: Set(chrono::Utc::now()),
                    ..Default::default()
                };
                let model = new_user.insert(conn).await.map_err(map_db_error)?;
                Ok(Some(model.id.to_string()))
            }
            DbCommand::GetUser { id, .. } => {
                use sb_db_entities::user::Entity;
                use sea_orm::EntityTrait;
                let user_id: uuid::Uuid = (*id).into();
                let model = Entity::find_by_id(user_id)
                    .one(conn)
                    .await
                    .map_err(map_db_error)?
                    .ok_or(PersistenceError::NotFound)?;
                Ok(Some(model.display_name))
            }
            DbCommand::UpdateChipBalance { user_id, delta, .. } => {
                use sb_db_entities::user::{ActiveModel, Entity};
                use sea_orm::{ActiveModelTrait, EntityTrait, Set};
                let uid: uuid::Uuid = (*user_id).into();
                let model = Entity::find_by_id(uid)
                    .one(conn)
                    .await
                    .map_err(map_db_error)?
                    .ok_or(PersistenceError::NotFound)?;
                let mut active: ActiveModel = model.into();
                let current = active.chip_balance.take().unwrap_or(0);
                let new_balance = current + *delta;
                active.chip_balance = Set(new_balance);
                active.update(conn).await.map_err(map_db_error)?;
                Ok(None)
            }
            DbCommand::StoreHandHistory {
                table_id,
                played_at,
                players_json,
                actions_json,
                result_json,
                ..
            } => {
                use sb_db_entities::hand_history::ActiveModel;
                use sb_db_entities::hand_history_json::{HandActions, HandPlayers, HandResult};
                use sea_orm::{ActiveModelTrait, Set};
                let players: HandPlayers =
                    serde_json::from_value(players_json.clone()).map_err(|e| {
                        PersistenceError::ConstraintViolation(format!(
                            "Invalid players_json: {}",
                            e
                        ))
                    })?;
                let actions: HandActions =
                    serde_json::from_value(actions_json.clone()).map_err(|e| {
                        PersistenceError::ConstraintViolation(format!(
                            "Invalid actions_json: {}",
                            e
                        ))
                    })?;
                let result: HandResult =
                    serde_json::from_value(result_json.clone()).map_err(|e| {
                        PersistenceError::ConstraintViolation(format!("Invalid result_json: {}", e))
                    })?;
                let new_history = ActiveModel {
                    id: Set(uuid::Uuid::new_v4()),
                    table_id: Set(*table_id),
                    played_at: Set(*played_at),
                    players_json: Set(players),
                    actions_json: Set(actions),
                    result_json: Set(result),
                    is_archived: Set(false),
                };
                new_history.insert(conn).await.map_err(map_db_error)?;
                Ok(None)
            }
            DbCommand::ExecuteRaw { sql, .. } => {
                conn.execute_unprepared(sql).await.map_err(map_db_error)?;
                Ok(None)
            }
        };

        let rollback_sql = format!("ROLLBACK TO {}", sp_name);
        let release_sql = format!("RELEASE {}", sp_name);
        if result.is_err() {
            let _ = conn.execute_unprepared(&rollback_sql).await;
            result
        } else {
            let _ = conn.execute_unprepared(&release_sql).await;
            result
        }
    }
    .instrument(span)
    .await
}

fn map_db_error(e: sea_orm::DbErr) -> PersistenceError {
    match e {
        sea_orm::DbErr::Query(qe) => {
            let msg = qe.to_string();
            if msg.contains("UNIQUE constraint") || msg.contains("CHECK constraint") {
                PersistenceError::ConstraintViolation(msg)
            } else if msg.contains("NOT NULL") || msg.contains("FOREIGN KEY") {
                PersistenceError::DataIntegrity(msg)
            } else {
                PersistenceError::Transient(msg)
            }
        }
        _ => PersistenceError::Transient(e.to_string()),
    }
}

fn respond_ok(cmd: DbCommand, value: Option<String>) {
    match cmd {
        DbCommand::CreateUser { respond, .. } => {
            let id = value
                .and_then(|s| s.parse().ok())
                .unwrap_or_else(uuid::Uuid::new_v4)
                .into();
            let _ = respond.send(Ok(id));
        }
        DbCommand::GetUser { respond, .. } => {
            let name = value.unwrap_or_default();
            let _ = respond.send(Ok(name));
        }
        DbCommand::UpdateChipBalance { respond, .. } => {
            let _ = respond.send(Ok(()));
        }
        DbCommand::StoreHandHistory { respond, .. } => {
            let _ = respond.send(Ok(()));
        }
        DbCommand::ExecuteRaw { respond, .. } => {
            let _ = respond.send(Ok(()));
        }
    }
}

fn respond_err(cmd: DbCommand, err: PersistenceError) {
    match cmd {
        DbCommand::CreateUser { respond, .. } => {
            let _ = respond.send(Err(err));
        }
        DbCommand::GetUser { respond, .. } => {
            let _ = respond.send(Err(err));
        }
        DbCommand::UpdateChipBalance { respond, .. } => {
            let _ = respond.send(Err(err));
        }
        DbCommand::StoreHandHistory { respond, .. } => {
            let _ = respond.send(Err(err));
        }
        DbCommand::ExecuteRaw { respond, .. } => {
            let _ = respond.send(Err(err));
        }
    }
}

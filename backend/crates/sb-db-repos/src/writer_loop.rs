use sea_orm::{ConnectionTrait, DatabaseConnection, TransactionTrait};
use tokio::sync::mpsc;
use tokio::sync::watch;
use tracing::{Instrument, error, info, info_span};

use crate::commands::DbCommand;
use sb_contracts::repo_api::PersistenceError;

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
                Ok(()) => respond_ok(cmd, ()),
                Err(err) => respond_err(cmd, err),
            }
        }
    }
}

async fn run_command_in_savepoint(
    cmd: &mut DbCommand,
    conn: &impl ConnectionTrait,
    sp_name: &str,
) -> Result<(), PersistenceError> {
    let ctx = match cmd {
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
            DbCommand::ExecuteRaw { sql, .. } => {
                conn.execute_unprepared(sql).await.map_err(map_db_error)?;
                Ok(())
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

fn respond_ok(cmd: DbCommand, _value: ()) {
    match cmd {
        DbCommand::ExecuteRaw { respond, .. } => {
            let _ = respond.send(Ok(()));
        }
    }
}

fn respond_err(cmd: DbCommand, err: PersistenceError) {
    match cmd {
        DbCommand::ExecuteRaw { respond, .. } => {
            let _ = respond.send(Err(err));
        }
    }
}

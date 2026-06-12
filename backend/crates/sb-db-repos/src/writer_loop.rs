use sea_orm::{ConnectionTrait, DatabaseConnection, TransactionTrait};
use tokio::sync::mpsc;
use tracing::{Instrument, error, info_span};

use crate::commands::DbCommand;
use sb_contracts::repo_api::PersistenceError;

const BATCH_SIZE: usize = 50;

pub async fn writer_loop(mut rx: mpsc::UnboundedReceiver<DbCommand>, db: DatabaseConnection) {
    let mut batch = Vec::with_capacity(BATCH_SIZE);
    loop {
        tokio::select! {
            cmd = rx.recv() => {
                let Some(cmd) = cmd else { break };
                batch.push(cmd);
                if batch.len() >= BATCH_SIZE {
                    process_batch(&mut batch, &db).await;
                }
            }
            else => {
                if !batch.is_empty() {
                    process_batch(&mut batch, &db).await;
                }
            }
        }
    }
    if !batch.is_empty() {
        process_batch(&mut batch, &db).await;
    }
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

async fn run_command_in_savepoint<C: ConnectionTrait>(
    cmd: &mut DbCommand,
    conn: &C,
    sp_name: &str,
) -> Result<(), PersistenceError> {
    let span = info_span!("db_command", savepoint = sp_name);
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
        sea_orm::DbErr::Query(qe) if qe.to_string().contains("UNIQUE constraint") => {
            PersistenceError::ConstraintViolation(qe.to_string())
        }
        sea_orm::DbErr::Query(qe) if qe.to_string().contains("CHECK constraint") => {
            PersistenceError::ConstraintViolation(qe.to_string())
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

use sb_db_repos::{commands::DbCommand, writer_loop::writer_loop};
use sb_shared_types::RequestContext;
use sea_orm::{ConnectionTrait, Database};
use tokio::sync::{mpsc, oneshot};
use uuid::Uuid;

#[tokio::test]
async fn batch_isolation_violation_rollback_only_bad_command() {
    let db = Database::connect("sqlite::memory:").await.unwrap();
    db.execute_unprepared("CREATE TABLE test (id INTEGER PRIMARY KEY, value TEXT UNIQUE)")
        .await
        .unwrap();

    let (tx, rx) = mpsc::unbounded_channel();
    let handle = tokio::spawn(writer_loop(rx, db.clone()));

    let (tx1, rx1) = oneshot::channel();
    let (tx2, rx2) = oneshot::channel();

    let sql_ok = "INSERT INTO test (value) VALUES ('foo')".to_string();
    let cmd_ok = DbCommand::ExecuteRaw {
        ctx: RequestContext::new(Uuid::new_v4(), None),
        sql: sql_ok,
        respond: tx1,
    };

    let sql_bad = "INSERT INTO test (value) VALUES ('foo')".to_string();
    let cmd_bad = DbCommand::ExecuteRaw {
        ctx: RequestContext::new(Uuid::new_v4(), None),
        sql: sql_bad,
        respond: tx2,
    };

    tx.send(cmd_ok).unwrap();
    tx.send(cmd_bad).unwrap();
    drop(tx);

    let res_ok = rx1.await.unwrap();
    let res_bad = rx2.await.unwrap();

    handle.abort();

    assert!(res_ok.is_ok());
    // The second command must fail (any PersistenceError)
    assert!(res_bad.is_err());
}

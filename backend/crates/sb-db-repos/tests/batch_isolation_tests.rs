use sb_db_repos::{commands::DbCommand, init_writer_loop};
use sb_shared_types::RequestContext;
use sea_orm::{ConnectionTrait, Database};
use sqlx::Row;
use tokio::sync::oneshot;
use uuid::Uuid;

#[tokio::test]
async fn batch_isolation_violation_rollback_only_bad_command() {
    let db = Database::connect("sqlite::memory:").await.unwrap();
    db.execute_unprepared("CREATE TABLE test (id INTEGER PRIMARY KEY, value TEXT UNIQUE)")
        .await
        .unwrap();

    let handle = init_writer_loop(db.clone(), Some(50));

    let (tx_ok, rx_ok) = oneshot::channel();
    let (tx_bad, rx_bad) = oneshot::channel();

    let sql_ok = "INSERT INTO test (value) VALUES ('foo')".to_string();
    let cmd_ok = DbCommand::ExecuteRaw {
        ctx: RequestContext::new(Uuid::new_v4(), None),
        sql: sql_ok,
        respond: tx_ok,
    };
    let sql_bad = "INSERT INTO test (value) VALUES ('foo')".to_string();
    let cmd_bad = DbCommand::ExecuteRaw {
        ctx: RequestContext::new(Uuid::new_v4(), None),
        sql: sql_bad,
        respond: tx_bad,
    };

    handle.sender.send(cmd_ok).unwrap();
    handle.sender.send(cmd_bad).unwrap();

    drop(handle.sender);
    handle.task.await.unwrap();

    let res_ok = rx_ok.await.unwrap();
    let res_bad = rx_bad.await.unwrap();

    assert!(res_ok.is_ok());
    assert!(res_bad.is_err());

    let pool = db.get_sqlite_connection_pool();
    let row = sqlx::query("SELECT value FROM test WHERE value = 'foo'")
        .fetch_optional(pool)
        .await
        .unwrap();
    assert!(row.is_some());
}

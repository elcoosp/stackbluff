pub mod commands;
pub mod hand_history_repo;
pub mod user_repo;
pub mod writer_loop;

use sea_orm::DatabaseConnection;
use tokio::sync::mpsc;

pub fn init_writer_loop(
    db: DatabaseConnection,
) -> (
    mpsc::UnboundedSender<commands::DbCommand>,
    tokio::task::JoinHandle<()>,
) {
    let (tx, rx) = mpsc::unbounded_channel();
    let handle = tokio::spawn(writer_loop::writer_loop(rx, db));
    (tx, handle)
}

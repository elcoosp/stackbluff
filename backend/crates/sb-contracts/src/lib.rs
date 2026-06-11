use sb_shared_types::{PlayerId, TableId};
use thiserror::Error;

#[derive(Debug, Error)]
pub enum TableError {
    #[error("Table {0} not found")]
    NotFound(TableId),
    #[error("Table {0} is full")]
    TableFull(TableId),
    #[error("Internal actor error: {0}")]
    ActorError(String),
}

#[derive(Debug)]
pub enum TableCommand {
    Join {
        player_id: PlayerId,
        table_id: TableId,
        response_tx: tokio::sync::oneshot::Sender<Result<(), TableError>>,
    },
    Heartbeat {
        table_id: TableId,
    },
}

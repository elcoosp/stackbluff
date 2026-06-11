//! Table registry and actor

pub mod actor;

use tokio::sync::mpsc;
use sb_ws_handler::BroadcastSender;
use sb_ws_messages::ServerMessage;
use sb_shared_types::{TableId, TableConfig};

pub fn spawn_table_actor(
    table_id: TableId,
    config: TableConfig,
    broadcast_tx: BroadcastSender<ServerMessage>,
) -> (actor::TableHandle, tokio::task::JoinHandle<()>) {
    let (cmd_tx, cmd_rx) = mpsc::channel(32);
    let handle = actor::TableHandle::new(cmd_tx.clone());
    let actor = actor::TableActor::new(table_id, config, broadcast_tx, cmd_tx);
    let join = tokio::spawn(actor.run(cmd_rx));
    (handle, join)
}

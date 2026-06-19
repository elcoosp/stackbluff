use chrono::{DateTime, Utc};
use sb_contracts::repo_api::HandHistoryRepository;
use sb_db_entities::hand_history_json::{HandActions, HandPlayers, HandResult};
use sb_shared_types::{RequestContext, TableId};
use std::sync::Arc;
use tracing::{error, warn};
use uuid::Uuid;

#[derive(Debug, Clone)]
pub struct HandCompletedEvent {
    pub table_id: TableId,
    pub played_at: DateTime<Utc>,
    pub players: HandPlayers,
    pub actions: HandActions,
    pub result: HandResult,
}

/// Spawns a background consumer that receives hand completion events
/// and persists them via the HandHistoryRepository.
pub fn spawn_history_recorder(
    mut rx: tokio::sync::broadcast::Receiver<HandCompletedEvent>,
    repo: Arc<dyn HandHistoryRepository + Send + Sync>,
) -> tokio::task::JoinHandle<()> {
    tokio::spawn(async move {
        loop {
            match rx.recv().await {
                Ok(event) => {
                    let hand_data = serde_json::json!({
                        "table_id": event.table_id.as_uuid(),
                        "played_at": event.played_at,
                        "players": event.players,
                        "actions": event.actions,
                        "result": event.result,
                    });
                    let ctx = RequestContext::new(Uuid::new_v4(), None);
                    if let Err(e) = repo.store_hand(ctx, hand_data).await {
                        error!(error = ?e, "Failed to store hand history");
                    }
                }
                Err(tokio::sync::broadcast::error::RecvError::Lagged(n)) => {
                    warn!(lagged = n, "History recorder lagged, skipping events");
                }
                Err(tokio::sync::broadcast::error::RecvError::Closed) => {
                    info!("History recorder channel closed, exiting");
                    break;
                }
            }
        }
    })
}

use tracing::info;

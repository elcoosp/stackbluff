use chrono::{DateTime, Utc};
use sb_contracts::repo_api::HandHistoryRepository;
use sb_db_entities::hand_history_json::{HandActions, HandPlayers, HandResult};
use sb_shared_types::{RequestContext, TableId};
use std::sync::Arc;
use tracing::{error, info, warn};
use uuid::Uuid;

#[derive(Debug, Clone)]
pub struct HandCompletedEvent {
    pub table_id: TableId, // The parent lobby blueprint
    pub room_id: TableId,  // The specific actor instance
    pub played_at: DateTime<Utc>,
    pub players: HandPlayers,
    pub actions: HandActions,
    pub result: HandResult,
    /// Players eliminated this hand, with their starting stacks (sorted).
    pub busted_players: Vec<(sb_shared_types::UserId, sb_shared_types::ChipAmount)>,
}

/// Spawns a background consumer that receives hand completion events
/// and persists them via the HandHistoryRepository.

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct TableClosedEvent {
    pub table_id: TableId,
    pub room_id: TableId,
    pub started_by: sb_shared_types::UserId,
    pub winner: Option<sb_shared_types::UserId>,
    pub winning_hand_description: String,
    pub pot_amount: sb_shared_types::ChipAmount,
    pub chat_id: Option<String>,
}

#[derive(Debug, Clone)]
pub enum TableEvent {
    HandCompleted(HandCompletedEvent),
    TableClosed(TableClosedEvent),
}

/// Spawns a background consumer that receives table events and persists hand histories.
pub fn spawn_history_recorder(
    mut rx: tokio::sync::broadcast::Receiver<TableEvent>,
    repo: Arc<dyn HandHistoryRepository + Send + Sync>,
) -> tokio::task::JoinHandle<()> {
    tokio::spawn(async move {
        loop {
            match rx.recv().await {
                Ok(TableEvent::HandCompleted(event)) => {
                    let hand_data = serde_json::json!({
                        "table_id": event.table_id.as_uuid(),
                        "played_at": event.played_at,
                        "players": event.players,
                        "actions": event.actions,
                        "result": event.result
                    });
                    let ctx = RequestContext::new(Uuid::new_v4(), None);
                    if let Err(e) = repo.store_hand(ctx, hand_data).await {
                        error!(error = ?e, "Failed to store hand history");
                    }
                }
                Ok(TableEvent::TableClosed(_)) => {
                    // TableClosed events are handled elsewhere; ignore them here.
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

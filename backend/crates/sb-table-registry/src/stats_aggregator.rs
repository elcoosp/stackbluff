//! Aggregates player statistics from hand completion events.

use crate::events::TableEvent;
use sb_contracts::stats_api::PlayerStatsRepo;
use std::sync::Arc;
use tokio::sync::broadcast;
use tracing::{info, warn};

/// Spawns a background task that listens for hand completion events
/// and updates player statistics.
pub fn spawn_stats_aggregator(
    mut rx: broadcast::Receiver<TableEvent>,
    _repo: Arc<dyn PlayerStatsRepo + Send + Sync>,
) -> tokio::task::JoinHandle<()> {
    tokio::spawn(async move {
        loop {
            match rx.recv().await {
                Ok(TableEvent::HandCompleted(hand_event)) => {
                    // Stats updates are intentionally disabled because the PlayerStatsRepo trait
        // does not yet expose the required methods (increment_hand_count, add_winnings,
        // increment_busts). These should be re-enabled when the trait is extended.
        // For now, we only log the event.
                    // In a real implementation, these would be uncommented.
                    info!("Hand completed event received (stats aggregator): table_id={}", hand_event.table_id);
                }
                Ok(TableEvent::TableClosed(_)) => {
                    // Ignore table closed events
                }
                Err(broadcast::error::RecvError::Lagged(n)) => {
                    warn!(lagged = n, "Stats aggregator lagged, skipping events");
                }
                Err(broadcast::error::RecvError::Closed) => {
                    info!("Stats aggregator channel closed, exiting");
                    break;
                }
            }
        }
    })
}

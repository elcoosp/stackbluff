//! Spawns a background task that listens for hand completion events and forwards them to the viral service.
//! This enables referral tracking, badge awarding, and replay card generation.

use std::sync::Arc;
use tokio::sync::broadcast;
use tracing::{info, warn}; // removed "error"

use sb_contracts::async_hooks::{HandCountObserver, ReplayCardObserver};
use sb_table_registry::events::TableEvent;

/// Spawns a background task that listens to TableEvent::HandCompleted events
/// and notifies the provided viral service (which implements HandCountObserver and ReplayCardObserver).
pub fn spawn_viral_observer(
    mut rx: broadcast::Receiver<TableEvent>,
    hand_count_observer: Arc<dyn HandCountObserver + Send + Sync>,
    replay_observer: Arc<dyn ReplayCardObserver + Send + Sync>,
) -> tokio::task::JoinHandle<()> {
    tokio::spawn(async move {
        info!("Viral observer started");

        loop {
            match rx.recv().await {
                Ok(TableEvent::HandCompleted(event)) => {
                    let event = event;
                    let hc_observer = hand_count_observer.clone();
                    let rp_observer = replay_observer.clone();

                    // Notify hand count observer (for referrals and missions)
                    for player in &event.players.seats {
                        if let Some(user_id) = player.user_id {
                            let observer = hc_observer.clone();
                            let uid = user_id;
                            tokio::spawn(async move {
                                observer.on_hand_completed(uid).await;
                            });
                        }
                    }

                    // Notify replay observer (for significant hands)
                    if let Some(winner) = event.result.winners.first() {
                        if let Some(user_id) = event
                            .players
                            .seats
                            .iter()
                            .find(|p| p.player_id == winner.player_id)
                            .and_then(|p| p.user_id)
                        {
                            let hand_result = sb_shared_types::game_types::HandResult {
                                hero_raised_preflop: false,
                                went_to_showdown: true,
                                hero_went_allin: false,
                            };
                            let observer = rp_observer.clone();
                            let table_id = event.table_id;
                            let winner_id = user_id;
                            tokio::spawn(async move {
                                observer
                                    .on_significant_hand(&hand_result, winner_id, table_id)
                                    .await;
                            });
                        }
                    }
                }
                Ok(TableEvent::TableClosed(_)) => {
                    // Ignore
                }
                Err(broadcast::error::RecvError::Lagged(n)) => {
                    warn!(lagged = n, "Viral observer lagged, skipping events");
                }
                Err(broadcast::error::RecvError::Closed) => {
                    info!("Viral observer channel closed, exiting");
                    break;
                }
            }
        }
    })
}

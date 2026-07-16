//! Spawns a background task that listens for hand completion events and forwards them to the viral service.
//! This enables referral tracking, badge awarding, and replay card generation.

use std::sync::Arc;
use tokio::sync::broadcast;
use tracing::{info, warn};
use uuid::Uuid;

use sb_contracts::async_hooks::{HandCountObserver, ReplayCardObserver};
use sb_contracts::service_api::MissionApi;
use sb_shared_types::RequestContext;
use sb_shared_types::game_types::HandResult;
use sb_table_registry::events::TableEvent;

/// Spawns a background task that listens to TableEvent::HandCompleted events
/// and notifies the provided viral service (which implements HandCountObserver and ReplayCardObserver)
/// and the mission service.
pub fn spawn_viral_observer(
    mut rx: broadcast::Receiver<TableEvent>,
    hand_count_observer: Arc<dyn HandCountObserver + Send + Sync>,
    replay_observer: Arc<dyn ReplayCardObserver + Send + Sync>,
    mission_service: Arc<dyn MissionApi + Send + Sync>,
) -> tokio::task::JoinHandle<()> {
    tokio::spawn(async move {
        info!("Viral observer started");

        loop {
            match rx.recv().await {
                Ok(TableEvent::HandCompleted(event)) => {
                                        let hc_observer = hand_count_observer.clone();
                    let rp_observer = replay_observer.clone();
                    let mission_svc = mission_service.clone();

                    // Notify hand count observer (for referrals) and mission service per player
                    for player in &event.players.seats {
                        if let Some(user_id) = player.user_id {
                            // Build HandResult for this player using the stored flags
                            let hand_result = HandResult {
                                hero_raised_preflop: player.raised_preflop,
                                went_to_showdown: player.went_to_showdown,
                                hero_went_allin: player.went_allin,
                            };

                            // HandCountObserver
                            let observer = hc_observer.clone();
                            let uid = user_id;
                            let hr = hand_result.clone();
                            tokio::spawn(async move {
                                if let Err(e) = observer.on_hand_completed(uid, &hr).await {
                                    tracing::error!(%uid, error = %e, "Viral hand_count observer failed for participant");
                                }
                            });

                            // Mission service
                            let ms = mission_svc.clone();
                            let uid2 = user_id;
                            let hr2 = hand_result;
                            let ctx = RequestContext::new(Uuid::new_v4(), Some(uid2));
                            tokio::spawn(async move {
                                if let Err(e) = ms.on_hand_completed(&ctx, &hr2).await {
                                    tracing::error!(%uid2, error = %e, "Mission service failed for participant");
                                }
                            });
                        }
                    }

                    // Notify replay observer (for significant hands)
                    if let Some(winner) = event.result.winners.first()
                        && let Some(user_id) = event
                            .players
                            .seats
                            .iter()
                            .find(|p| p.player_id == winner.player_id)
                            .and_then(|p| p.user_id)
                    {
                        let hand_result = HandResult {
                            hero_raised_preflop: event.players.seats.iter().find(|p| p.user_id == Some(user_id)).is_some_and(|p| p.raised_preflop),
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

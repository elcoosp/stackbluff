use crate::events::TableEvent;
use sb_contracts::stats_api::PlayerStatsRepo;
use sb_shared_types::PlayerId;
use sb_shared_types::player_stats::StatsDelta;
use std::collections::{HashMap, HashSet};
use std::sync::Arc;

pub fn spawn_stats_aggregator(
    mut event_rx: tokio::sync::broadcast::Receiver<TableEvent>,
    stats_repo: Arc<dyn PlayerStatsRepo + Send + Sync>,
) {
    tokio::spawn(async move {
        tracing::info!("Player stats aggregator started");

        while let Ok(event) = event_rx.recv().await {
        let event = match event {
            TableEvent::HandCompleted(e) => e,
            other => {
                tracing::debug!(event_type = ?std::mem::discriminant(&other), "Dropping non-hand-completed event in stats aggregator");
                continue;
            }
        };
            let mut deltas: HashMap<String, StatsDelta> = HashMap::new();
            let mut player_to_user: HashMap<PlayerId, String> = HashMap::new();

            // Sets to track hand-level states per player
            let mut folded_players: HashSet<PlayerId> = HashSet::new();
            let mut vpip_players: HashSet<PlayerId> = HashSet::new();
            let mut pfr_players: HashSet<PlayerId> = HashSet::new();
            let mut all_in_players: HashSet<PlayerId> = HashSet::new();
            let mut total_wagered_map: HashMap<PlayerId, i64> = HashMap::new();
            let mut bets_map: HashMap<PlayerId, i32> = HashMap::new();
            let mut raises_map: HashMap<PlayerId, i32> = HashMap::new();
            let mut calls_map: HashMap<PlayerId, i32> = HashMap::new();

            // 1. Initialize basic data for all participants
            for player in &event.players.seats {
                if let Some(user_id) = &player.user_id {
                    let uid_str = user_id.0.to_string();
                    player_to_user.insert(player.player_id, uid_str.clone());

                    let net_profit = player.stack_after - player.stack_before;

                    deltas.entry(uid_str.clone()).or_insert_with(|| StatsDelta {
                        user_id: uid_str,
                        hands_played: 1,
                        net_profit,
                        total_won: net_profit.max(0),
                        ..Default::default()
                    });
                }
            }

            // 2. Process Actions to calculate Aggression, VPIP, PFR, Folds
            for action in &event.actions.actions {
                let pid = &action.player_id;
                let action_type_lower = action.action_type.to_lowercase();

                // Track aggression and wagered amounts
                match action_type_lower.as_str() {
                    "bet" => *bets_map.entry(*pid).or_insert(0) += 1,
                    "raise" => *raises_map.entry(*pid).or_insert(0) += 1,
                    "call" => *calls_map.entry(*pid).or_insert(0) += 1,
                    "allin" | "all-in" | "all_in" => {
                        all_in_players.insert(*pid);
                    }
                    "fold" => {
                        folded_players.insert(*pid);
                    }
                    _ => {}
                }

                if let Some(amount) = action.amount
                    && amount > 0
                    && (action_type_lower.contains("bet")
                        || action_type_lower.contains("raise")
                        || action_type_lower.contains("call"))
                {
                    *total_wagered_map.entry(*pid).or_insert(0) += amount;
                }

                // VPIP / PFR Logic (Best effort based on action strings)
                // If the action string contains 'preflop' (e.g. "preflop_call"), or if it's a generic call/raise
                let is_preflop = action_type_lower.contains("preflop")
                    || (!action_type_lower.contains("flop")
                        && !action_type_lower.contains("turn")
                        && !action_type_lower.contains("river"));

                if is_preflop {
                    if action_type_lower.contains("call")
                        || action_type_lower.contains("raise")
                        || action_type_lower.contains("bet")
                    {
                        vpip_players.insert(*pid); // Voluntarily Put In Pot
                    }
                    if action_type_lower.contains("raise") || action_type_lower.contains("bet") {
                        pfr_players.insert(*pid); // Preflop Raise
                    }
                }
            }

            // 3. Determine if the hand went to Showdown
            // It's a showdown if more than 1 player did NOT fold
            let total_players = event.players.seats.len();
            let total_folded = folded_players.len();
            let is_showdown = total_players - total_folded > 1;

            // 4. Process Winners
            let mut winner_pids: HashSet<PlayerId> = HashSet::new();
            for winner in &event.result.winners {
                winner_pids.insert(winner.player_id);
                if let Some(uid_str) = player_to_user.get(&winner.player_id)
                    && let Some(delta) = deltas.get_mut(uid_str)
                {
                    delta.hands_won = 1;
                    if delta.biggest_pot_won < winner.amount_won {
                        delta.biggest_pot_won = winner.amount_won;
                    }
                }
            }

            // 5. Finalize all deltas by mapping our sets/maps to the StatsDelta struct
            for (pid, uid_str) in &player_to_user {
                if let Some(delta) = deltas.get_mut(uid_str) {
                    delta.bets = *bets_map.get(pid).unwrap_or(&0);
                    delta.raises = *raises_map.get(pid).unwrap_or(&0);
                    delta.calls = *calls_map.get(pid).unwrap_or(&0);
                    delta.total_wagered = *total_wagered_map.get(pid).unwrap_or(&0);

                    if all_in_players.contains(pid) {
                        delta.all_in_count = 1;
                    }

                    if vpip_players.contains(pid) {
                        delta.vpip_hands = 1;
                    }
                    if pfr_players.contains(pid) {
                        delta.pfr_hands = 1;
                    }

                    if folded_players.contains(pid) {
                        // If they folded, count it as a preflop fold for simplicity
                        // (can be improved if action logs explicitly separate streets)
                        delta.preflop_fold_count = 1;
                    }

                    if is_showdown {
                        if !folded_players.contains(pid) {
                            delta.showdowns = 1;
                            if winner_pids.contains(pid) {
                                delta.showdown_wins = 1;
                            }
                        }
                    } else {
                        // No showdown (everyone except winner folded)
                        if winner_pids.contains(pid) {
                            delta.hands_won_without_showdown = 1;
                        }
                    }
                }
            }

            // 6. Apply all deltas to the database
            for (_, delta) in deltas {
                if let Err(e) = stats_repo.apply_delta(delta).await {
                    tracing::error!("Failed to apply stats delta: {}", e);
                }
            }
        }
    });
}

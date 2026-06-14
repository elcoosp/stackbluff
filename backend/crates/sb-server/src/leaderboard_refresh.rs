use sb_contracts::ClubRepo;
use std::sync::Arc;
use std::time::Duration;
use tokio::time::interval;

/// Spawns a background task that refreshes all club leaderboards every 5 minutes.
pub fn spawn_leaderboard_refresh_job(repo: Arc<dyn ClubRepo>) {
    tokio::spawn(async move {
        let mut ticker = interval(Duration::from_secs(300));
        loop {
            ticker.tick().await;
            tracing::info!("leaderboard refresh job: starting");
            let start = std::time::Instant::now();
            match repo.get_all_club_ids().await {
                Ok(club_ids) => {
                    for club_id in &club_ids {
                        if let Err(e) = repo.refresh_leaderboard(*club_id).await {
                            tracing::warn!(
                                club_id = %club_id,
                                error = %e,
                                "leaderboard refresh job: failed for club"
                            );
                        }
                    }
                    let elapsed = start.elapsed();
                    tracing::info!(
                        count = club_ids.len(),
                        elapsed_ms = elapsed.as_millis(),
                        "leaderboard refresh job: completed"
                    );
                }
                Err(e) => {
                    tracing::error!(
                        error = %e,
                        "leaderboard refresh job: failed to list clubs"
                    );
                }
            }
        }
    });
}

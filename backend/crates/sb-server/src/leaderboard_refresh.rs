use sea_orm::DatabaseConnection;
use std::time::Duration;

pub async fn spawn_leaderboard_refresh_task(db: DatabaseConnection) {
    tokio::spawn(async move {
        let mut interval = tokio::time::interval(Duration::from_secs(300));
        interval.tick().await; // skip immediate tick
        loop {
            interval.tick().await;
            match sb_db_repos::refresh_leaderboard_mv(&db).await {
                Ok(()) => tracing::info!("Leaderboard materialised view refreshed"),
                Err(e) => tracing::error!("Failed to refresh leaderboard MV: {:?}", e),
            }
        }
    });
}

use crate::db::PaymentRepo;
use sea_orm::DatabaseConnection;
use tokio::time::{Duration, interval};
use tracing::{error, info};

pub async fn start_expiry_task(db: DatabaseConnection, interval_minutes: u64) {
    let mut ticker = interval(Duration::from_secs(interval_minutes * 60));
    info!(
        "Expiry task started, runs every {} minutes",
        interval_minutes
    );
    loop {
        ticker.tick().await;
        match PaymentRepo::expire_pending_older_than(&db, 10).await {
            Ok(count) => {
                if count > 0 {
                    info!(expired_count = count, "Marked pending payments as expired");
                }
            }
            Err(e) => error!(error = %e, "Expiry task failed"),
        }
    }
}

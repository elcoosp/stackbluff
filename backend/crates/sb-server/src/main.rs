mod leaderboard_refresh;

use axum::Router;
use sb_club::{club_router, ClubServiceImpl};
use sb_contracts::ClubRepo;
use sb_db_repos::ClubRepoImpl;
use sea_orm::Database;
use std::sync::Arc;

#[tokio::main]
async fn main() {
    tracing_subscriber::fmt::init();

    let db_url = std::env::var("DATABASE_URL")
        .unwrap_or_else(|_| "sqlite://stackbluff.db?mode=rwc".to_string());

    let db = Database::connect(&db_url)
        .await
        .expect("failed to connect to database");

    // Run migrations
    migration::Migrator::up(&db, None)
        .await
        .expect("failed to run migrations");

    // ── Club wiring ────────────────────────────────────────
    let club_repo: Arc<dyn ClubRepo> = Arc::new(ClubRepoImpl::new(db.clone()));
    let club_service = Arc::new(ClubServiceImpl::new(club_repo.clone()));

    // Spawn the 5-minute leaderboard refresh job
    leaderboard_refresh::spawn_leaderboard_refresh_job(club_repo);

    let club_state = sb_club::handlers::ClubState {
        service: club_service,
    };

    let app = Router::new().merge(club_router(club_state));

    let listener = tokio::net::TcpListener::bind("0.0.0.0:3000")
        .await
        .expect("failed to bind port 3000");

    tracing::info!("server listening on {}", listener.local_addr().unwrap());
    axum::serve(listener, app)
        .await
        .expect("server error");
}

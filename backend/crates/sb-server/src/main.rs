mod leaderboard_refresh;
#[cfg(feature = "test-stubs")]
mod test_utils;

use axum::Router;
use sea_orm::Database;
use sea_orm_migration::MigratorTrait;
use std::sync::Arc;
use tower_http::cors::{Any, CorsLayer};

// Import the necessary types from your crates
use sb_auth::{AuthServiceImpl, SharedAuthService, config::AuthConfig, routes::auth_router};
use sb_contracts::repo_api::UserRepo;
use sb_db_repos::init_writer_loop;
use sb_db_repos::user_repo::UserRepoImpl;

#[cfg(feature = "test-stubs")]
use test_utils::notification_service::InMemoryNotificationService;
#[cfg(feature = "test-stubs")]
use test_utils::table_service::InMemoryTableService;
#[cfg(feature = "test-stubs")]
use test_utils::user_resolution_service::InMemoryUserResolutionService;

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

    // ── Initialize DB Writer Loop & Repos ─────────────────
    let writer_handle = init_writer_loop(db.clone(), None);
    let user_repo: Arc<dyn UserRepo> = Arc::new(UserRepoImpl::new(writer_handle.sender.clone()));

    // ── Wire up Auth Service ──────────────────────────────
    let auth_config = AuthConfig::from_env();
    let auth_service: SharedAuthService = Arc::new(AuthServiceImpl::new(user_repo, auth_config));

    // ── Wire up bot handler services ──────────────────────
    let bot_state = build_bot_state();

    let oracle_service = Arc::new(sb_oracle::OracleServiceImpl::new());

    // Configure CORS
    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    let app = Router::new()
        // .merge(club_router(club_state))
        .merge(sb_bot_handler::attach(bot_state))
        .merge(sb_rest_router::oracle_routes::oracle_router(oracle_service))
        .merge(auth_router(auth_service)) // Use the sb-auth router!
        .layer(cors);

    let listener = tokio::net::TcpListener::bind("0.0.0.0:3000")
        .await
        .expect("failed to bind port 3000");

    tracing::info!("server listening on {}", listener.local_addr().unwrap());
    axum::serve(listener, app).await.expect("server error");
}

#[cfg(feature = "test-stubs")]
fn build_bot_state() -> Arc<sb_bot_handler::BotState> {
    let table_service: Arc<dyn sb_contracts::service_api::TableService> =
        Arc::new(InMemoryTableService::new());
    let notification_service: Arc<dyn sb_contracts::notification_api::NotificationService> =
        Arc::new(InMemoryNotificationService::new());
    let user_resolution: Arc<dyn sb_contracts::user_resolution::UserResolutionService> =
        Arc::new(InMemoryUserResolutionService::new());

    Arc::new(sb_bot_handler::BotState::new(
        table_service,
        notification_service,
        user_resolution,
        std::env::var("TELEGRAM_BOT_TOKEN").unwrap_or_default(),
        std::env::var("MINI_APP_URL").unwrap_or_else(|_| "http://localhost:5173/".to_string()),
    ))
}

#[cfg(not(feature = "test-stubs"))]
fn build_bot_state() -> Arc<sb_bot_handler::BotState> {
    compile_error!(
        "Production service wiring not yet configured. \
         Build with --features test-stubs for development."
    );
}

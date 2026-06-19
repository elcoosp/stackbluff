mod leaderboard_refresh;
#[cfg(feature = "test-stubs")]
mod test_utils;

use axum::Router;
use axum::http::Method;
use axum::http::header;
use sea_orm::Database;
use sea_orm_migration::MigratorTrait;
use std::sync::Arc;
use std::time::Duration;
use tower_cookies::CookieManagerLayer;
use tower_http::cors::CorsLayer;

use sb_auth::{
    AuthServiceImpl, Authenticator, SharedAuthService, config::AuthConfig, routes::auth_router,
};
use sb_contracts::lobby_api::TableRepo;
use sb_contracts::repo_api::UserRepo;
use sb_db_repos::init_writer_loop;
use sb_db_repos::user_repo::UserRepoImpl;
use sb_rest_router::create_router;
use sb_shared_types::{ChipAmount, GameVariant, StakeLevel, TableConfig};
use sb_table_registry::buy_in_limits_for_stake; // <--- ADDED
use sb_table_registry::registry::Registry;
use sb_table_registry::table_service::TableServiceImpl;
use sb_ws_handler::ws_route;

#[cfg(feature = "test-stubs")]
use test_utils::notification_service::InMemoryNotificationService;
#[cfg(feature = "test-stubs")]
use test_utils::table_service::InMemoryTableService;
#[cfg(feature = "test-stubs")]
use test_utils::user_resolution_service::InMemoryUserResolutionService;

#[tokio::main]
async fn main() {
    tracing_subscriber::fmt().init();

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
    let auth_impl = Arc::new(AuthServiceImpl::new(user_repo, auth_config));
    let auth_service: SharedAuthService = auth_impl.clone();
    let auth_authenticator: Arc<dyn Authenticator + Send + Sync> = auth_impl;

    // ── Wire up bot handler services ──────────────────────
    let bot_state = build_bot_state();

    let oracle_service = Arc::new(sb_oracle::OracleServiceImpl::new());

    // ── Initialize Table Repo, Service, and Registry ─────────────
    let table_repo: Arc<dyn TableRepo + Send + Sync> =
        Arc::new(sb_db_repos::table_repo::TableRepoImpl::new(db.clone()));
    let registry = Arc::new(Registry::new());

    // ── Hydrate Registry from DB (DB is source of truth) ─────────
    let db_tables = table_repo
        .list_tables()
        .await
        .expect("failed to list DB tables");
    for t in &db_tables {
        let (min_buy_in, max_buy_in) = buy_in_limits_for_stake(t.stake_level); // <--- ADDED
        let config = TableConfig {
            max_players: t.max_players as u8,
            stake_level: t.stake_level,
            variant: GameVariant::Holdem,
            min_buy_in, // <--- was ChipAmount::new(100).unwrap()
            max_buy_in, // <--- was ChipAmount::new(10000).unwrap()
        };
        registry.register_existing_table(t.table_id, config).await;
        tracing::info!(table_id = %t.table_id, "Hydrated table from DB");
    }
    tracing::info!(count = db_tables.len(), "Registry hydrated from DB");

    // ── Create TableService (coordinates DB + Registry) ──────────
    let table_service: Arc<dyn sb_contracts::lobby_api::TableService> =
        Arc::new(TableServiceImpl::new(registry.clone(), table_repo.clone()));

    // ── Create default table only if DB is empty ─────────────────
    if db_tables.is_empty() {
        let default_table_id = table_service
            .create_cash_table(StakeLevel::Micro, 6)
            .await
            .expect("failed to create default table");
        tracing::info!(%default_table_id, "Default table created (DB was empty)");
    }

    // ── Rest Router (lobby, tables) ─────────────────────────────
    let rest_router = create_router(table_service.clone(), table_repo.clone(), registry.clone());

    // Configure CORS
    let allowed_origins = vec![
        "http://localhost:5173".parse().unwrap(),
        "http://localhost:5174".parse().unwrap(),
    ];
    let cors = CorsLayer::new()
        .allow_origin(allowed_origins.clone())
        .allow_credentials(true)
        .allow_methods([Method::GET, Method::POST, Method::OPTIONS])
        .allow_headers([header::CONTENT_TYPE, header::COOKIE, header::AUTHORIZATION])
        .max_age(Duration::from_secs(86400));

    // Build the application router
    let app = Router::new()
        .merge(rest_router)
        .merge(ws_route(auth_authenticator.clone(), registry.clone()))
        .merge(auth_router(auth_service))
        .merge(sb_bot_handler::attach(bot_state))
        .merge(sb_rest_router::oracle_router(oracle_service))
        .layer(cors)
        .layer(CookieManagerLayer::new());

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

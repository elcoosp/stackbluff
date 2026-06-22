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
use sb_contracts::repo_api::{HandHistoryRepository, UserRepo};
use sb_contracts::stats_api::PlayerStatsRepo;
use sb_db_repos::hand_history_repo::{HandHistoryRepoImpl, spawn_hand_history_cleanup};
use sb_db_repos::init_writer_loop;
use sb_db_repos::player_stats_repo::PlayerStatsRepoImpl;
use sb_db_repos::user_repo::UserRepoImpl;
use sb_rest_router::create_router;
use sb_rest_router::player_stats::player_stats_routes;
use sb_shared_types::{GameVariant, StakeLevel, TableConfig};
use sb_table_registry::buy_in_limits_for_stake;
use sb_table_registry::registry::Registry;
use sb_table_registry::spawn_history_recorder;
use sb_table_registry::stats_aggregator::spawn_stats_aggregator;
use sb_table_registry::table_service::TableServiceImpl;
use sb_ws_handler::ws_route;

#[cfg(feature = "test-stubs")]
use test_utils::notification_service::InMemoryNotificationService;
#[cfg(feature = "test-stubs")]
use test_utils::table_service::InMemoryTableService;
#[cfg(feature = "test-stubs")]
use test_utils::user_resolution_service::InMemoryUserResolutionService;
mod hand_archive;

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

    leaderboard_refresh::spawn_leaderboard_refresh_task(db.clone()).await;

    // ── Initialize DB Writer Loop & Repos ─────────────────
    let writer_handle = init_writer_loop(db.clone(), None);
    let user_repo: Arc<dyn UserRepo> = Arc::new(UserRepoImpl::new(writer_handle.sender.clone()));

    // ── Wire up Auth Service ──────────────────────────────
    let auth_config = AuthConfig::from_env();
    let auth_impl = Arc::new(AuthServiceImpl::new(user_repo.clone(), auth_config));
    let auth_service: SharedAuthService = auth_impl.clone();
    let auth_authenticator: Arc<dyn Authenticator + Send + Sync> = auth_impl;

    // ── Wire up bot handler services ──────────────────────
    let bot_state = build_bot_state();

    let oracle_service = Arc::new(sb_oracle::OracleServiceImpl::new());

    // ── Initialize Table Repo, Service, and Registry ─────────────
    let table_repo: Arc<dyn TableRepo + Send + Sync> =
        Arc::new(sb_db_repos::table_repo::TableRepoImpl::new(db.clone()));

    // ── Initialize Player Stats Repository ───────────────────────
    let stats_repo: Arc<dyn PlayerStatsRepo + Send + Sync> =
        Arc::new(PlayerStatsRepoImpl::new(db.clone()));

    let registry = Arc::new(Registry::new(stats_repo.clone()));

    // ── Hydrate Registry from DB (DB is source of truth) ─────────
    let db_tables = table_repo
        .list_tables()
        .await
        .expect("failed to list DB tables");
    for t in &db_tables {
        let (min_buy_in, max_buy_in) = buy_in_limits_for_stake(t.stake_level);
        let config = TableConfig {
            max_players: t.max_players as u8,
            stake_level: t.stake_level,
            variant: GameVariant::Holdem,
            min_buy_in,
            max_buy_in,
            turn_time_limit_ms: 30_000,
        };
        registry.register_existing_table(t.table_id, config).await;
        tracing::info!(table_id = %t.table_id, "Hydrated table config from DB");
    }
    tracing::info!(count = db_tables.len(), "Registry hydrated from DB");

    // Spawn Room Reaper
    Registry::spawn_room_reaper(registry.clone()).await;

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

    // ── Initialize Hand History Repository ───────────────────────
    let leaderboard_repo = Arc::new(sb_db_repos::LeaderboardRepo::new(db.clone()));

    let hand_history_repo: Arc<dyn HandHistoryRepository + Send + Sync> = Arc::new(
        HandHistoryRepoImpl::new(writer_handle.sender.clone(), db.clone()),
    );

    // ── Spawn History Event Recorder ─────────────────────────────
    let event_rx = registry.event_sender().subscribe();
    spawn_history_recorder(event_rx, hand_history_repo.clone());

    // ── Spawn Hand History Cleanup Task ──────────────────────────
    spawn_hand_history_cleanup(db.clone()).await;

    // ── Spawn Player Stats Aggregator ────────────────────────────
    let stats_event_rx = registry.event_sender().subscribe();
    spawn_stats_aggregator(stats_event_rx, stats_repo.clone());

    // ── Rest Router (lobby, tables, history, stats) ──────────────
    let rest_router = create_router(
        table_service.clone(),
        table_repo.clone(),
        registry.clone(),
        hand_history_repo.clone(),
        leaderboard_repo.clone(),
    )
    .merge(player_stats_routes(stats_repo.clone(), user_repo.clone()));

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
    let r2_config = aws_config::defaults(aws_config::BehaviorVersion::latest())
        .endpoint_url(std::env::var("R2_ENDPOINT").expect("R2_ENDPOINT not set"))
        .load()
        .await;
    let r2_client = aws_sdk_s3::Client::new(&r2_config);
    let r2: std::sync::Arc<dyn hand_archive::R2Storage> = std::sync::Arc::new(hand_archive::RealR2::new(r2_client, std::env::var("R2_BUCKET").expect("R2_BUCKET not set")));
    let archive_state = Arc::new(hand_archive::ArchiveState {
        db: db.clone(),
        r2,
    });
    let app = Router::new()
        .merge(rest_router)
        .merge(ws_route(
            auth_authenticator.clone(),
            registry.clone(),
            user_repo.clone(),
        ))
        .merge(auth_router(auth_service))
        .merge(sb_bot_handler::attach(bot_state))
        .merge(sb_rest_router::oracle_router(oracle_service))
        .merge(hand_archive::router(archive_state.clone()))
        .layer(cors)
        .layer(CookieManagerLayer::new());

    let listener = tokio::net::TcpListener::bind("0.0.0.0:3000")
        .await
        .expect("failed to bind port 3000");

    tracing::info!("server listening on {}", listener.local_addr().unwrap());
    let scheduler_state = archive_state.clone();
    tokio::spawn(async move {
        if let Err(e) = hand_archive::start_archival_scheduler(scheduler_state).await {
            eprintln!("Scheduler error: {e}");
        }
    });
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
    )
}

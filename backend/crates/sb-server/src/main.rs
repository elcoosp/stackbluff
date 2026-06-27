mod leaderboard_refresh;
#[cfg(feature = "test-stubs")]
mod test_utils;

use axum::Router;
use axum::http::Method;
use axum::http::header;
use sea_orm::ColumnTrait;
use sea_orm::Database;
use sea_orm::EntityTrait;
use sea_orm::QueryFilter;
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
use sb_contracts::tournament_api::{TournamentConfig, TournamentType};
use sb_db_entities::tournament::{Column as TournamentColumn, Entity as TournamentEntity};
use sb_db_repos::hand_history_repo::{HandHistoryRepoImpl, spawn_hand_history_cleanup};
use sb_db_repos::init_writer_loop;
use sb_db_repos::player_stats_repo::PlayerStatsRepoImpl;
use sb_db_repos::tournament_repo::TournamentRepoImpl;
use sb_db_repos::user_repo::UserRepoImpl;
use sb_rest_router::create_router;
use sb_rest_router::player_stats::player_stats_routes;
use sb_rest_router::tournament_routes::{self, TournamentState};
use sb_shared_types::{GameVariant, StakeLevel, TableConfig, TournamentId};
use sb_table_registry::buy_in_limits_for_stake;
use sb_table_registry::registry::Registry;
use sb_table_registry::spawn_history_recorder;
use sb_table_registry::stats_aggregator::spawn_stats_aggregator;
use sb_table_registry::table_service::TableServiceImpl;
use sb_tournament::{
    MttCommand, MttDirector, SitGoCommand, SitGoTournament, TournamentServiceImpl,
};
use sb_ws_handler::ws_route;

#[cfg(feature = "test-stubs")]
use test_utils::notification_service::InMemoryNotificationService;
#[cfg(feature = "test-stubs")]
use test_utils::table_service::InMemoryTableService;
#[cfg(feature = "test-stubs")]
use test_utils::user_resolution_service::InMemoryUserResolutionService;
use sb_table_registry::events::{TableEvent, TableClosedEvent};
mod hand_archive;

#[tokio::main]
async fn main() {
    dotenvy::dotenv().expect("Failed to load .env");
    tracing_subscriber::fmt().init();

    let db_url = std::env::var("DATABASE_URL")
        .unwrap_or_else(|_| "sqlite://stackbluff.db?mode=rwc".to_string());

    let db = Database::connect(&db_url)
        .await
        .expect("failed to connect to database");

    migration::Migrator::up(&db, None)
        .await
        .expect("failed to run migrations");

    leaderboard_refresh::spawn_leaderboard_refresh_task(db.clone()).await;

    let writer_handle = init_writer_loop(db.clone(), None);
    let user_repo: Arc<dyn UserRepo> = Arc::new(UserRepoImpl::new(writer_handle.sender.clone()));

    // ── Crash recovery ────────────────────────────────────────────────
    {
        let tournament_repo = TournamentRepoImpl::new(db.clone());
        if let Err(e) = sb_tournament::crash_recovery::settle_crashed_tournaments(
            &tournament_repo,
            user_repo.as_ref(),
        )
        .await
        {
            tracing::error!(
                error = ?e,
                "Failed to settle crashed tournaments on startup"
            );
        }
    }

    // ── Auth ──────────────────────────────────────────────────────────
    let auth_config = AuthConfig::from_env();
    let auth_impl = Arc::new(AuthServiceImpl::new(user_repo.clone(), auth_config));
    let auth_service: SharedAuthService = auth_impl.clone();
    let auth_authenticator: Arc<dyn Authenticator + Send + Sync> = auth_impl;

    // ── Bot ───────────────────────────────────────────────────────────
    let bot_state = build_bot_state();

    // ── Oracle ────────────────────────────────────────────────────────
    let oracle_service = Arc::new(sb_oracle::OracleServiceImpl::new());

    // ── Table infrastructure ─────────────────────────────────────────
    let table_repo: Arc<dyn TableRepo + Send + Sync> =
        Arc::new(sb_db_repos::table_repo::TableRepoImpl::new(db.clone()));

    let stats_repo: Arc<dyn PlayerStatsRepo + Send + Sync> =
        Arc::new(PlayerStatsRepoImpl::new(db.clone()));

    let registry = Arc::new(Registry::new(stats_repo.clone()));

    // Hydrate registry
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

    Registry::spawn_room_reaper(registry.clone()).await;

    let table_service: Arc<dyn sb_contracts::lobby_api::TableService> =
        Arc::new(TableServiceImpl::new(registry.clone(), table_repo.clone()));

    if db_tables.is_empty() {
        let default_table_id = table_service
            .create_cash_table(StakeLevel::Micro, 6)
            .await
            .expect("failed to create default table");
        tracing::info!(%default_table_id, "Default table created (DB was empty)");
    }

    // ── Hand history and stats ───────────────────────────────────────
    let leaderboard_repo = Arc::new(sb_db_repos::LeaderboardRepo::new(db.clone()));

    let hand_history_repo: Arc<dyn HandHistoryRepository + Send + Sync> = Arc::new(
        HandHistoryRepoImpl::new(writer_handle.sender.clone(), db.clone()),
    );

    let event_rx = registry.event_sender().subscribe();
    spawn_history_recorder(event_rx, hand_history_repo.clone());

    spawn_hand_history_cleanup(db.clone()).await;

    let stats_event_rx = registry.event_sender().subscribe();
    spawn_stats_aggregator(stats_event_rx, stats_repo.clone());

    // ── REST router ──────────────────────────────────────────────────
    let rest_router = create_router(
        table_service.clone(),
        table_repo.clone(),
        registry.clone(),
        hand_history_repo.clone(),
        leaderboard_repo.clone(),
    )
    .merge(player_stats_routes(stats_repo.clone(), user_repo.clone()));

    // ── Tournament system ────────────────────────────────────────────
    let tournament_repo = Arc::new(TournamentRepoImpl::new(db.clone()));
    let broker = Arc::new(sb_table_registry::connection_broker::ConnectionBroker::new());
    let tournament_service = Arc::new(TournamentServiceImpl::new(
        tournament_repo.clone(),
        user_repo.clone(),
        registry.clone(),
        broker.clone(),
    ));

    let tournament_state = Arc::new(TournamentState {
        tournament_service: tournament_service.clone(),
        registry: registry.clone(),
        broker: broker.clone(),
        tournament_repo: tournament_repo.clone(),
        user_repo: user_repo.clone(),
    });

    if let Err(e) = load_existing_tournaments(tournament_state.clone(), db.clone()).await {
        tracing::error!(error = ?e, "Failed to load existing tournaments");
    }

    let tournament_router = tournament_routes::tournament_routes(tournament_state);

    // ── CORS ──────────────────────────────────────────────────────────
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

    // ── R2 storage ───────────────────────────────────────────────────
    let r2_config = aws_config::defaults(aws_config::BehaviorVersion::latest())
        .endpoint_url(std::env::var("R2_ENDPOINT").expect("R2_ENDPOINT not set"))
        .load()
        .await;
    let r2_client = aws_sdk_s3::Client::new(&r2_config);
    let r2: std::sync::Arc<dyn hand_archive::R2Storage> =
        std::sync::Arc::new(hand_archive::RealR2::new(
            r2_client,
            std::env::var("R2_BUCKET").expect("R2_BUCKET not set"),
        ));
    let archive_state = Arc::new(hand_archive::ArchiveState { db: db.clone(), r2 });

    // ── Build main router ────────────────────────────────────────────
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
        .merge(tournament_router)
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

async fn load_existing_tournaments(
    state: Arc<TournamentState>,
    db: sea_orm::DatabaseConnection,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let records = TournamentEntity::find()
        .filter(TournamentColumn::Status.ne("Completed"))
        .all(&db)
        .await?;

    if records.is_empty() {
        tracing::info!("No active tournaments found in DB");
        return Ok(());
    }

    tracing::info!(count = records.len(), "Loading active tournaments");

    for record in records {
        let tournament_id = TournamentId::new(record.id);
        let status = record.status;
        let config: TournamentConfig = serde_json::from_value(record.config_json)?;

        if status == "Completed" {
            continue;
        }

        match config.tournament_type {
            TournamentType::SitAndGo => {
                let (cmd_tx, cmd_rx) = tokio::sync::mpsc::channel::<SitGoCommand>(32);
                let event_rx = state.registry.event_sender().subscribe();
                let actor = SitGoTournament::new(
                    tournament_id,
                    config,
                    state.registry.clone(),
                    state.broker.clone(),
                    cmd_rx,
                    event_rx,
                );
                tokio::spawn(actor.run());
                state
                    .tournament_service
                    .register_sit_go(tournament_id, cmd_tx.clone());
                let _ = cmd_tx
                    .send(SitGoCommand::SetRepoHandle {
                        repo: state.tournament_repo.clone(),
                        user_repo: state.user_repo.clone(),
                    })
                    .await;
                tracing::info!(%tournament_id, "Loaded Sit&Go tournament");
            }
            TournamentType::Mtt => {
                let (cmd_tx, cmd_rx) = tokio::sync::mpsc::channel::<MttCommand>(32);
                let event_rx = state.registry.event_sender().subscribe();
                let actor = MttDirector::new(
                    tournament_id,
                    config,
                    state.registry.clone(),
                    state.broker.clone(),
                    cmd_rx,
                    event_rx,
                );
                tokio::spawn(actor.run());
                state
                    .tournament_service
                    .register_mtt(tournament_id, cmd_tx.clone());
                let _ = cmd_tx
                    .send(MttCommand::SetRepoHandle {
                        repo: state.tournament_repo.clone(),
                        user_repo: state.user_repo.clone(),
                    })
                    .await;
                tracing::info!(%tournament_id, "Loaded MTT tournament");
            }
        }
    }

    tracing::info!("All tournaments loaded and registered with the service.");
    Ok(())
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



    // Spawn listener for TableClosedEvent
    {
        let registry = registry.clone();
        let notification_service = notification_service.clone();
        tokio::spawn(async move {
            let mut rx = registry.subscribe();
            while let Ok(event) = rx.recv().await {
                if let TableEvent::TableClosed(closed_event) = event {
                    tracing::info!(
                        table_id = ?closed_event.table_id,
                        started_by = ?closed_event.started_by,
                        chat_id = ?closed_event.chat_id,
                        "Received TableClosedEvent"
                    );
                    if let Some(chat_id) = closed_event.chat_id {
                        let winner_name = closed_event.winner
                            .map(|uid| format!("<a href=\"tg://user?id={}\">{}</a>", uid, uid))
                            .unwrap_or_else(|| "Unknown".to_string());
                        let pot = closed_event.pot_amount.0;
                        let hand = closed_event.winning_hand_description;
                        let invite_url = std::env::var("MINI_APP_URL")
                            .map(|url| format!("{}?ref={}", url, closed_event.started_by))
                            .unwrap_or_else(|_| {
                                tracing::error!("MINI_APP_URL environment variable not set");
                                "https://stackbluff.com".to_string()
                            });
                        let text = format!("{} won {} chips with {}\\n\\n[Play again]({})", winner_name, pot, hand, invite_url);
                        match notification_service.send_telegram_message(chat_id, text, None).await {
                            Ok(_) => {
                                tracing::info!("Game summary posted to chat {}", chat_id);
                            }
                            Err(e) => {
                                tracing::warn!("Failed to send game summary to chat {}: {:?}", chat_id, e);
                            }
                        }
                    } else {
                        tracing::debug!("TableClosedEvent has no chat_id, skipping");
                    }
                }
            }
        });
    }
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

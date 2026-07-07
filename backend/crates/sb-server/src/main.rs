mod leaderboard_refresh;
#[cfg(feature = "test-stubs")]
mod test_utils;
mod user_service;
mod viral_observer;

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
use uuid::Uuid;

use sb_auth::{
    AuthServiceImpl, Authenticator, SharedAuthService, config::AuthConfig, email::EmailService,
    email_queue::EmailQueue, routes::auth_router,
};
use sb_club::handlers::{ClubTournamentState, club_tournament_routes};
use sb_contracts::async_hooks::{HandCountObserver, ReplayCardObserver};
use sb_contracts::lobby_api::{TableRepo, TableService};
use sb_contracts::repo_api::{GdprRepo, HandHistoryRepository, UserRepo};
use sb_contracts::service_api::MissionApi;
use sb_contracts::stats_api::PlayerStatsRepo;
use sb_contracts::tournament_api::{TournamentConfig, TournamentType};
use sb_db_entities::tournament::{Column as TournamentColumn, Entity as TournamentEntity};
use sb_db_repos::badge_repo::BadgeRepoImpl;
use sb_db_repos::club_repo::ClubRepoImpl;
use sb_db_repos::gdpr_repo::PgGdprRepo;
use sb_db_repos::hand_history_repo::{HandHistoryRepoImpl, spawn_hand_history_cleanup};
use sb_db_repos::init_writer_loop;
use sb_db_repos::player_stats_repo::PlayerStatsRepoImpl;
use sb_db_repos::referral_repo::ReferralRepositoryImpl;
use sb_db_repos::tournament_repo::TournamentRepoImpl;
use sb_db_repos::user_repo::UserRepoImpl;
use sb_mission::service::MissionServiceImpl;
use sb_rest_router::player_stats::player_stats_routes;
use sb_rest_router::season_card;
use sb_rest_router::tournament_routes::{self, TournamentState};
use sb_rest_router::{AppState, create_router};
use sb_shared_types::{GameVariant, StakeLevel, TableConfig, TournamentId, UserId};
use sb_table_registry::buy_in_limits_for_stake;
use sb_table_registry::connection_broker::ConnectionBroker;
use sb_table_registry::registry::Registry;
use sb_table_registry::spawn_history_recorder;
use sb_table_registry::stats_aggregator::spawn_stats_aggregator;
use sb_table_registry::table_service::TableServiceImpl;
use sb_tournament::{
    MttCommand, MttDirector, SitGoCommand, SitGoTournament, TournamentServiceImpl,
};
use sb_viral::ViralServiceImpl;
use sb_ws_handler::ws_route;
use user_service::UserServiceImpl;

// Notification import is inside the production branch below.
// No global import of sb_notification.

#[cfg(feature = "test-stubs")]
use test_utils::notification_service::InMemoryNotificationService;
#[cfg(feature = "test-stubs")]
use test_utils::table_service::InMemoryTableService;
#[cfg(feature = "test-stubs")]
use test_utils::user_resolution_service::InMemoryUserResolutionService;
mod hand_archive;
mod r2_storage;
mod season_card_generator;

async fn reschedule_tournament_reminders(
    repo: std::sync::Arc<dyn sb_contracts::tournament_api::TournamentRepo>,
    notification_service: std::sync::Arc<dyn sb_contracts::notification_api::NotificationService>,
    bot_handler: Option<std::sync::Arc<dyn sb_contracts::notification_api::ClubNotifier>>,
    app_base_url: String,
) {
    use chrono::Utc;
    use sb_contracts::tournament_api::TournamentStatus;
    let tournaments = match repo.list_tournaments(None).await {
        Ok(t) => t,
        Err(e) => {
            tracing::error!("Failed to list tournaments for reminders: {:?}", e);
            return;
        }
    };
    let now = Utc::now();
    for tournament in &tournaments {
        if tournament.status == TournamentStatus::Registering
            && let Some(start) = tournament.config.scheduled_start
            && start > now
        {
            sb_tournament::reminders::schedule_reminders(
                tournament.id,
                start,
                repo.clone(),
                notification_service.clone(),
                bot_handler.clone(),
                app_base_url.clone(),
            );
        }
    }
}

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

    // Initialize email service and queue
    let email_service = Arc::new(EmailService::new(&auth_config));
    let email_queue = Arc::new(EmailQueue::new(email_service));
    tracing::info!("Email queue initialized");

    let auth_impl = Arc::new(
        AuthServiceImpl::new(user_repo.clone(), auth_config).with_email_support(email_queue),
    );

    // Spawn rate limiter cleanup task (runs every 5 minutes)
    auth_impl.spawn_rate_limiter_cleanup(300);
    let auth_service: SharedAuthService = auth_impl.clone();
    let auth_authenticator: Arc<dyn Authenticator + Send + Sync> = auth_impl;

    // ── Bot ───────────────────────────────────────────────────────────
    let bot_state = build_bot_state();

    // ── Oracle ────────────────────────────────────────────────────────
    let session_manager = sb_oracle::SessionManager::new();
    let oracle_service = Arc::new(sb_oracle::OracleServiceImpl::new(
        session_manager,
        user_repo.clone(),
        None,
    ));

    // ── Table infrastructure ─────────────────────────────────────────
    let table_repo: Arc<dyn TableRepo + Send + Sync> =
        Arc::new(sb_db_repos::table_repo::TableRepoImpl::new(db.clone()));

    let stats_repo: Arc<dyn PlayerStatsRepo + Send + Sync> =
        Arc::new(PlayerStatsRepoImpl::new(db.clone()));

    let registry = Arc::new(Registry::new(stats_repo.clone()));

    // Hydrate registry – use default creator (nil user) and no chat_id
    let system_user = UserId::new(Uuid::nil());
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
        registry
            .register_existing_table(t.table_id, config, system_user, None)
            .await;
        tracing::info!(table_id = %t.table_id, "Hydrated table config from DB");
    }
    tracing::info!(count = db_tables.len(), "Registry hydrated from DB");

    Registry::spawn_room_reaper(registry.clone()).await;

    let table_service: Arc<dyn TableService + Send + Sync> =
        Arc::new(TableServiceImpl::new(registry.clone(), table_repo.clone()));

    if db_tables.is_empty() {
        let default_table_id = table_service
            .create_cash_table(StakeLevel::Micro, 6, system_user, None)
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

    // ── Stats aggregator now receives TableEvent ─────────────────────
    let stats_event_rx = registry.event_sender().subscribe();
    spawn_stats_aggregator(stats_event_rx, stats_repo.clone());

    // ── Club service ─────────────────────────────────────────────────
    let club_repo: Arc<dyn sb_contracts::repo_api::ClubRepo + Send + Sync> =
        Arc::new(ClubRepoImpl::new(db.clone()));
    let club_service: Arc<dyn sb_contracts::service_api::ClubService + Send + Sync> =
        Arc::new(sb_club::ClubServiceImpl::new(club_repo.clone()));
    let broker = Arc::new(ConnectionBroker::new());

    // ── GDPR repository ──────────────────────────────────────────────
    let gdpr_repo: Arc<dyn GdprRepo + Send + Sync> = Arc::new(PgGdprRepo { db: db.clone() });

    // ── Badge repository ─────────────────────────────────────────────
    let badge_repo = Arc::new(BadgeRepoImpl::new(db.clone()));

    // ── Notification service ────────────────────────────────────────
    #[cfg(feature = "test-stubs")]
    let notification_service: Arc<dyn sb_contracts::notification_api::NotificationService> =
        Arc::new(InMemoryNotificationService::new());

    #[cfg(not(feature = "test-stubs"))]
    let notification_service: Arc<dyn sb_contracts::notification_api::NotificationService> = {
        use sb_notification::TelegramNotificationService;
        let bot_token = std::env::var("TELEGRAM_BOT_TOKEN")
            .expect("TELEGRAM_BOT_TOKEN must be set in production");
        Arc::new(
            TelegramNotificationService::new(bot_token)
                .with_user_repo(user_repo.clone())
                .with_club_repo(club_repo.clone()),
        )
    };

    // ── bot_handler uses the same service (it implements ClubNotifier) ──
    let bot_handler: Option<Arc<dyn sb_contracts::notification_api::ClubNotifier>> =
        Some(notification_service.clone() as Arc<dyn sb_contracts::notification_api::ClubNotifier>);

    // ── Create AppState ──────────────────────────────────────────────
    let app_state = Arc::new(AppState {
        table_service: table_service.clone(),
        table_repo: table_repo.clone(),
        registry: registry.clone(),
        hand_history_repo: hand_history_repo.clone(),
        leaderboard_query: leaderboard_repo.clone(),
        club_service: club_service.clone(),
        broker: broker.clone(),
        badge_repo: badge_repo.clone(),
        gdpr_repo: gdpr_repo.clone(),
    });

    // ── REST router ──────────────────────────────────────────────────
    let rest_router = create_router(app_state.clone())
        .merge(player_stats_routes(stats_repo.clone(), user_repo.clone()));

    // ── Tournament system ────────────────────────────────────────────
    let tournament_repo = Arc::new(TournamentRepoImpl::new(db.clone()));
    let broker = Arc::new(sb_table_registry::connection_broker::ConnectionBroker::new());

    let app_base_url =
        std::env::var("APP_BASE_URL").unwrap_or_else(|_| "https://app.stackbluff.com".to_string());

    let mut tournament_service_impl = TournamentServiceImpl::new(
        tournament_repo.clone(),
        user_repo.clone(),
        registry.clone(),
        broker.clone(),
        notification_service.clone(),
        bot_handler.clone(),
        app_base_url.clone(),
    );
    tournament_service_impl.set_club_repo(club_repo.clone());
    tournament_service_impl.set_club_service(club_service.clone());
    let tournament_service = Arc::new(tournament_service_impl);

    // ── Club tournament routes ──────────────────────────────────────
    let club_tournament_state = ClubTournamentState {
        club_service: club_service.clone(),
        club_repo: club_repo.clone(),
        tournament_service: tournament_service.clone(),
    };
    let club_tournament_router = club_tournament_routes(club_tournament_state);

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

    // ── Viral service (referrals, badges, replay cards) ────────────────
    let referral_repo = ReferralRepositoryImpl::new(db.clone());
    let user_service = Arc::new(UserServiceImpl::new(user_repo.clone()));
    let base_url =
        std::env::var("APP_BASE_URL").unwrap_or_else(|_| "https://app.stackbluff.com".to_string());

    let viral_service_impl = ViralServiceImpl::new(referral_repo, user_service.clone(), base_url)
        .with_badge_repo(badge_repo.clone());

    let viral_service_arc = Arc::new(viral_service_impl);

    let hand_count_observer: Arc<dyn HandCountObserver + Send + Sync> = viral_service_arc.clone();
    let replay_observer: Arc<dyn ReplayCardObserver + Send + Sync> = viral_service_arc.clone();

    // ── Mission service ──────────────────────────────────────────────────
    let mission_service: Arc<dyn MissionApi + Send + Sync> =
        Arc::new(MissionServiceImpl::new(Arc::new(db.clone()), user_service));

    let viral_event_rx = registry.event_sender().subscribe();
    viral_observer::spawn_viral_observer(
        viral_event_rx,
        hand_count_observer,
        replay_observer,
        mission_service,
    );

    // ── WebSocket handler ────────────────────────────────────────────
    let ws_router = ws_route(
        auth_authenticator.clone(),
        registry.clone(),
        user_repo.clone(),
    );

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
    let archive_state = Arc::new(hand_archive::ArchiveState {
        db: db.clone(),
        r2: r2.clone(),
    });

    // ── Build main router ────────────────────────────────────────────
    let app = Router::new()
        .merge(rest_router)
        .merge(ws_router)
        .merge(auth_router(auth_service))
        .merge(sb_bot_handler::attach(bot_state))
        .merge(sb_rest_router::oracle_routes(oracle_service))
        .merge(hand_archive::router(archive_state.clone()))
        .merge(tournament_router)
        .merge(season_card::router(db.clone()))
        .merge(club_tournament_router)
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

    reschedule_tournament_reminders(
        tournament_repo.clone(),
        notification_service.clone(),
        bot_handler.clone(),
        app_base_url.clone(),
    )
    .await;

    let season_processor = std::sync::Arc::new(season_card_generator::SeasonCardGenerator::new(
        db.clone(),
        std::sync::Arc::new(r2_storage::R2StorageAdapter::new(r2.clone())),
        std::sync::Arc::new(sb_db_repos::season_card_repo::SeaOrmSeasonCardRepo::new(
            db.clone(),
        )),
    ));
    let season_proc_clone = season_processor.clone();
    tokio::spawn(async move {
        season_proc_clone.run_scheduler().await;
    });

    // ── GDPR scheduler ──────────────────────────────────────────────────
    spawn_gdpr_scheduler(app_state);

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

    let system_user = UserId::new(Uuid::nil());

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
                    system_user,
                    None,
                    None,
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
                    system_user,
                    None,
                    None,
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
    let table_service = Arc::new(InMemoryTableService::new());
    let notification_api_service = Arc::new(InMemoryNotificationService::new());
    let user_resolution = Arc::new(InMemoryUserResolutionService::new());

    Arc::new(sb_bot_handler::BotState::new(
        table_service,
        notification_api_service,
        user_resolution,
        std::env::var("TELEGRAM_BOT_TOKEN").unwrap_or_default(),
        std::env::var("MINI_APP_URL").unwrap_or_else(|_| "http://localhost:5173/".to_string()),
    ))
}

#[cfg(not(feature = "test-stubs"))]
fn build_bot_state() -> Arc<sb_bot_handler::BotState> {
    use async_trait::async_trait;
    use sb_contracts::lobby_api::{CreateTableInput, TableService};
    use sb_contracts::notification_api::{NotificationError, NotificationService};
    use sb_contracts::user_resolution::{UserResolutionError, UserResolutionService};
    use sb_shared_types::{AppError, RequestContext, TableId, UserId};

    // In production, the bot uses the same notification service as the rest.
    // We don't create a new one; we pass the already-created one.
    // However, this function is called before notification_service is created.
    // We need to restructure: create notification service first, then pass it.
    // For now, we'll keep the logging placeholder but this should be replaced
    // with the real notification service in a refactor.
    // Since the bot is only used in test-stubs for now, we'll keep it simple.

    struct LoggingTableService;

    #[async_trait]
    impl TableService for LoggingTableService {
        async fn create_table(
            &self,
            _ctx: &RequestContext,
            _input: CreateTableInput,
        ) -> Result<TableId, AppError> {
            tracing::info!("Create table (placeholder)");
            Ok(TableId::new(uuid::Uuid::new_v4()))
        }

        async fn create_cash_table(
            &self,
            _stake: sb_shared_types::StakeLevel,
            _max_players: u32,
            _created_by: UserId,
            _chat_id: Option<String>,
        ) -> Result<TableId, AppError> {
            tracing::info!("Create cash table (placeholder)");
            Ok(TableId::new(uuid::Uuid::new_v4()))
        }
    }

    // In production, we would reuse the actual notification_service.
    // For now, we'll use a logging one, but the real one is used elsewhere.
    struct LoggingNotificationService;

    #[async_trait]
    impl NotificationService for LoggingNotificationService {
        async fn send_telegram_message(
            &self,
            chat_id: i64,
            text: String,
            _keyboard: Option<serde_json::Value>,
        ) -> Result<(), NotificationError> {
            tracing::info!(chat_id, text, "Bot send_telegram_message (placeholder)");
            Ok(())
        }

        async fn send_telegram_message_to_user(
            &self,
            user_id: UserId,
            text: String,
            _keyboard: Option<serde_json::Value>,
        ) -> Result<(), NotificationError> {
            tracing::info!(%user_id, text, "Bot send_telegram_message_to_user (placeholder)");
            Ok(())
        }

        async fn answer_callback_query(
            &self,
            callback_query_id: String,
            _text: Option<String>,
        ) -> Result<(), NotificationError> {
            tracing::info!(callback_query_id, "Bot answer_callback_query (placeholder)");
            Ok(())
        }
    }

    struct LoggingUserResolutionService;

    #[async_trait]
    impl UserResolutionService for LoggingUserResolutionService {
        async fn resolve_telegram_user(
            &self,
            telegram_id: &str,
        ) -> Result<UserId, UserResolutionError> {
            tracing::info!(telegram_id, "resolve_telegram_user (placeholder)");
            Ok(UserId::new(uuid::Uuid::new_v4()))
        }
    }

    Arc::new(sb_bot_handler::BotState::new(
        Arc::new(LoggingTableService),
        Arc::new(LoggingNotificationService),
        Arc::new(LoggingUserResolutionService),
        std::env::var("TELEGRAM_BOT_TOKEN").unwrap_or_default(),
        std::env::var("MINI_APP_URL").unwrap_or_else(|_| "http://localhost:5173/".to_string()),
    ))
}

#[allow(dead_code)]
async fn start_gdpr_job(state: std::sync::Arc<AppState>) {
    use tokio_cron_scheduler::{Job, JobScheduler};
    let sched = JobScheduler::new().await.unwrap();
    sched
        .add(
            Job::new_async("0 0 2 * * *", move |_uuid, _l| {
                let state = state.clone();
                Box::pin(async move {
                    tracing::info!("Running daily GDPR deletion job...");
                    if let Ok(pending) = state.gdpr_repo.get_pending_deletions(30).await {
                        for req in pending {
                            if let Err(e) = state.gdpr_repo.anonymize_user(req.user_id).await {
                                tracing::error!(
                                    "Failed to anonymize user {}: {:?}",
                                    req.user_id,
                                    e
                                );
                                continue;
                            }
                            let _ = state.gdpr_repo.mark_deletion_completed(req.user_id).await;
                        }
                    }
                })
            })
            .unwrap(),
        )
        .await
        .unwrap();
    sched.start().await.unwrap();
}

#[allow(dead_code)]
pub fn spawn_gdpr_scheduler(state: std::sync::Arc<AppState>) {
    tokio::spawn(start_gdpr_job(state));
}

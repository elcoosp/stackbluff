mod anti_cheat_routes;
mod leaderboard_refresh;
mod test_utils;
mod user_service;
mod viral_observer;

use axum::{
    Extension, Router,
    extract::Request,
    http::Method,
    http::header,
    middleware::{self, Next},
    response::Response,
};
use sea_orm::ColumnTrait;
use sea_orm::Database;
use sea_orm::EntityTrait;
use sea_orm::QueryFilter;
use sea_orm_migration::MigratorTrait;
use std::sync::Arc;
use std::time::Duration;
use tower_cookies::CookieManagerLayer;
use tower_http::cors::CorsLayer;
use tower_http::compression::CompressionLayer;
use uuid::Uuid;

use sb_auth::middleware::auth_middleware_with_context;
use sb_auth::{
    AuthServiceImpl, Authenticator, SharedAuthService, config::AuthConfig, email::EmailService,
    email_queue::EmailQueue, routes::auth_router,
};
use sb_club::handlers::{ClubTournamentState, club_tournament_routes};
use sb_club::{club_router, handlers::ClubState};
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
use sb_db_repos::push_subscription_repo::PushSubscriptionRepo;
use sb_db_repos::init_writer_loop;
use sb_db_repos::player_stats_repo::PlayerStatsRepoImpl;
use sb_db_repos::product_repo::ProductRepoImpl;
use sb_db_repos::referral_repo::ReferralRepositoryImpl;
use sb_db_repos::tournament_repo::TournamentRepoImpl;
use sb_db_repos::puzzle_repo::PuzzleRepoImpl;
use sb_db_repos::user_repo::UserRepoImpl;
use sb_mission::service::MissionServiceImpl;
use sb_payment::RealPaymentService;
use sb_rest_router::notification_routes::notification_routes;

use sb_rest_router::player_stats::player_stats_routes;

use sb_rest_router::season_card;

use sb_rest_router::tournament_routes::{self, TournamentState};

use sb_rest_router::{AppState, create_router};
use sb_rest_router::rate_limit::rate_limit_layer;

use sb_shared_types::request_context::RequestContext;
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
use user_service::{UserResolutionServiceImpl, UserServiceImpl};

use test_utils::notification_service::InMemoryNotificationService;
mod hand_archive;
mod r2_storage;
mod season_card_generator;

fn main() {
    dotenvy::dotenv().expect("Failed to load .env");
    tracing_subscriber::fmt()
        .json()
        .with_env_filter(tracing_subscriber::EnvFilter::from_default_env())
        .init();
    // Initialize Sentry
    let _guard = {
        let dsn = std::env::var("SENTRY_DSN").unwrap_or_default();
        if !dsn.is_empty() {
            Some(sentry::init((
                dsn,
                sentry::ClientOptions {
                    release: sentry::release_name!(),
                    send_default_pii: true,
                    ..Default::default()
                },
            )))
        } else {
            None
        }
    };

    // Start the tokio runtime
    tokio::runtime::Builder::new_multi_thread()
        .enable_all()
        .build()
        .unwrap()
        .block_on(run_app());
}
async fn request_context_middleware(mut req: Request, next: Next) -> Response {
    let request_id = req
        .headers()
        .get("x-correlation-id")
        .and_then(|v| v.to_str().ok())
        .and_then(|s| Uuid::parse_str(s).ok())
        .unwrap_or_else(Uuid::new_v4);

    let ip = req
        .headers()
        .get("x-forwarded-for")
        .and_then(|v| v.to_str().ok())
        .and_then(|s| s.split(',').next())
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
        .unwrap_or_else(|| "0.0.0.0".to_string());

    let mut user_id = None;

    let token = req
        .headers()
        .get("Authorization")
        .and_then(|h| h.to_str().ok())
        .and_then(|h| h.strip_prefix("Bearer "))
        .map(|t| t.to_string())
        .or_else(|| {
            req.extensions()
                .get::<tower_cookies::Cookies>()
                .and_then(|cookies| cookies.get("token").map(|c| c.value().to_string()))
        });

    if let Some(token) = token {
        if let Some(auth_service) = req.extensions().get::<SharedAuthService>() {
            match auth_service.verify_token(&token).await {
                Ok(claims) => {
                    user_id = Some(claims.user_id);
                    req.extensions_mut().insert(sb_auth::middleware::AuthUser {
                        user_id: claims.user_id.0.to_string(),
                    });
                    tracing::debug!(user_id = %user_id.unwrap(), "Token verified, user ID set in context");
                }
                Err(e) => {
                    tracing::warn!(error = %e, "Token verification failed");
                }
            }
        } else {
            tracing::warn!("SharedAuthService not found in request extensions");
        }
    } else {
        tracing::debug!("No token found in request");
    }

    let ctx = RequestContext {
        request_id,
        ip,
        user_id,
    };

    req.extensions_mut().insert(ctx);
    next.run(req).await
}

async fn reschedule_tournament_reminders(
    repo: std::sync::Arc<dyn sb_contracts::tournament_api::TournamentRepo>,
    notification_service: std::sync::Arc<dyn sb_contracts::notification_api::NotificationService>,
    bot_handler: Option<std::sync::Arc<dyn sb_contracts::notification_api::ClubNotifier>>,
    app_base_url: String,
) {
    match repo.list_tournaments(None, None).await {
        Ok(tournaments) => {
            for t in tournaments {
                if let Some(start) = t.config.scheduled_start
                    && start > chrono::Utc::now()
                {
                    sb_tournament::reminders::schedule_reminders(
                        t.id,
                        start,
                        repo.clone(),
                        notification_service.clone(),
                        bot_handler.clone(),
                        app_base_url.clone(),
                    );
                    tracing::info!(tournament_id = %t.id, "Rescheduled tournament reminders");
                }
            }
        }
        Err(e) => tracing::error!(error = ?e, "Failed to fetch tournaments for reminder rescheduling"),
    }
}

async fn run_app() {
    let db_url = std::env::var("DATABASE_URL").expect("DATABASE_URL must be set");

    let db = Database::connect(&db_url)
        .await
        .expect("failed to connect to database");

    migration::Migrator::up(&db, None)
        .await
        .expect("failed to run migrations");

    leaderboard_refresh::spawn_leaderboard_refresh_task(db.clone()).await;

    let writer_handle = init_writer_loop(db.clone(), None);
    let user_repo: Arc<dyn UserRepo> = Arc::new(UserRepoImpl::new(writer_handle.sender.clone()));

    let user_svc = Arc::new(UserServiceImpl::new(user_repo.clone()));
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

    let auth_config = AuthConfig::from_env();

    let email_service = Arc::new(EmailService::new(&auth_config));
    let email_queue = Arc::new(EmailQueue::new(email_service));
    tracing::info!("Email queue initialized");

    let auth_impl = Arc::new(
        AuthServiceImpl::new(user_repo.clone(), auth_config).with_email_support(email_queue),
    );
    let auth_service: SharedAuthService = auth_impl.clone();
    let auth_authenticator: Arc<dyn Authenticator + Send + Sync> = auth_impl;

    let session_manager = sb_oracle::SessionManager::new();
    let oracle_service = Arc::new(sb_oracle::OracleServiceImpl::new(
        session_manager,
        user_repo.clone(),
        None,
    ));

    let table_repo: Arc<dyn TableRepo + Send + Sync> =
        Arc::new(sb_db_repos::table_repo::TableRepoImpl::new(db.clone()));

    let stats_repo: Arc<dyn PlayerStatsRepo + Send + Sync> =
        Arc::new(PlayerStatsRepoImpl::new(db.clone()));

    let registry = Arc::new(Registry::new(stats_repo.clone()));

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

    let leaderboard_repo = Arc::new(sb_db_repos::LeaderboardRepo::new(db.clone()));

    let hand_history_repo: Arc<dyn HandHistoryRepository + Send + Sync> = Arc::new(
        HandHistoryRepoImpl::new(writer_handle.sender.clone(), db.clone()),
    );

    let product_repo: Arc<dyn sb_contracts::product_api::ProductRepo + Send + Sync> =
        Arc::new(ProductRepoImpl::new(db.clone()));
    let payment_config = sb_payment::PaymentConfig::from_env().expect("Payment config");
    let stripe_secret_key =
        std::env::var("STRIPE_SECRET_KEY").expect("STRIPE_SECRET_KEY must be set");
    let payment_service = Arc::new(RealPaymentService::new(
        db.clone(),
        stripe_secret_key,
        user_svc.clone(),
        payment_config,
    ));
    let _puzzle_repo: Arc<dyn sb_contracts::puzzle_repo::PuzzleRepo + Send + Sync> =
        Arc::new(PuzzleRepoImpl::new(db.clone()));
    let event_rx = registry.event_sender().subscribe();
    spawn_history_recorder(event_rx, hand_history_repo.clone());

    spawn_hand_history_cleanup(db.clone()).await;

    let push_db = db.clone();
    tokio::spawn(async move {
        let mut interval = tokio::time::interval(std::time::Duration::from_secs(3600));
        loop {
            interval.tick().await;
            let repo = sb_db_repos::push_subscription_repo::PushSubscriptionRepoImpl { db: push_db.clone() };
            if let Err(e) = repo.delete_expired().await {
                tracing::error!("Failed to cleanup expired push subscriptions: {}", e);
            }
        }
    });

    let stats_event_rx = registry.event_sender().subscribe();
    let is_bot_cache: moka::future::Cache<sb_shared_types::UserId, bool> = moka::future::Cache::new(10_000);
    spawn_stats_aggregator(stats_event_rx, stats_repo.clone(), is_bot_cache.clone());

    let club_repo: Arc<dyn sb_contracts::repo_api::ClubRepo + Send + Sync> =
        Arc::new(ClubRepoImpl::new(db.clone()));
    let broker = Arc::new(ConnectionBroker::new());
    let club_service: Arc<dyn sb_contracts::service_api::ClubService + Send + Sync> = Arc::new(
        sb_club::ClubServiceImpl::new(club_repo.clone(), broker.clone()),
    );

    let gdpr_repo: Arc<dyn GdprRepo + Send + Sync> = Arc::new(PgGdprRepo { db: db.clone() });

    let badge_repo = Arc::new(BadgeRepoImpl::new(db.clone()));

    let (notification_service, bot_handler) = {
        let notif = Arc::new(InMemoryNotificationService::new());
        let notification_service =
            notif.clone() as Arc<dyn sb_contracts::notification_api::NotificationService>;
        let bot_handler = Some(notif as Arc<dyn sb_contracts::notification_api::ClubNotifier>);
        (notification_service, bot_handler)
    };

    let bot_state = {
        use sb_bot_handler::BotState;
        let user_resolution_service = Arc::new(UserResolutionServiceImpl::new(user_repo.clone()));
        Arc::new(BotState::new(
            table_service.clone(),
            notification_service.clone(),
            user_resolution_service.clone(),
            std::env::var("TELEGRAM_BOT_TOKEN")
                .expect("TELEGRAM_BOT_TOKEN must be set in production"),
            std::env::var("MINI_APP_URL").unwrap_or_else(|_| "http://localhost:5173/".to_string()),
        ))
    };

    let tournament_repo = Arc::new(TournamentRepoImpl::new(db.clone()));

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

    let club_tournament_state = ClubTournamentState {
        club_service: club_service.clone(),
        club_repo: club_repo.clone(),
        tournament_service: tournament_service.clone(),
        tournament_repo: tournament_repo.clone(),
    };
    let club_tournament_router = club_tournament_routes(club_tournament_state);

    let tournament_state = Arc::new(TournamentState {
        registry: registry.clone(),
        broker: broker.clone(),
        tournament_repo: tournament_repo.clone(),
        tournament_service: tournament_service.clone(),
        user_repo: user_repo.clone(),
    });

    if let Err(e) = load_existing_tournaments(tournament_state.clone(), db.clone()).await {
        tracing::error!(error = ?e, "Failed to load existing tournaments");
    }

    let tournament_router = tournament_routes::tournament_routes(tournament_state);

    let referral_repo = ReferralRepositoryImpl::new(db.clone());
    let base_url =
        std::env::var("APP_BASE_URL").unwrap_or_else(|_| "https://app.stackbluff.com".to_string());

    let viral_service_impl = ViralServiceImpl::new(referral_repo, user_svc.clone(), base_url)
        .with_badge_repo(badge_repo.clone());

    let viral_service_arc = Arc::new(viral_service_impl);

    let mission_service: Arc<dyn MissionApi + Send + Sync> = Arc::new(MissionServiceImpl::new(
        Arc::new(db.clone()),
        user_svc.clone(),
    ));
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
    // Wrap in the contract adapter
    let r2_contract: Arc<dyn sb_contracts::r2_storage::R2Storage + Send + Sync> =
        Arc::new(r2_storage::R2StorageAdapter::new(r2.clone()));

let app_state = Arc::new(AppState {
        table_service: table_service.clone(),
        table_repo: table_repo.clone(),
        registry: registry.clone(),
        hand_history_repo: hand_history_repo.clone(),
        leaderboard_query: leaderboard_repo.clone(),
        club_service: club_service.clone(),
        club_repo: club_repo.clone(),
        broker: broker.clone(),
        badge_repo: badge_repo.clone(),
        gdpr_repo: gdpr_repo.clone(),
        product_repo: product_repo.clone(),
        payment_service: payment_service.clone(),
        puzzle_repo: _puzzle_repo.clone(),
        r2: r2_contract.clone(),
        notification_service: notification_service.clone(),
        tournament_service: tournament_service.clone(),
        mission_service: mission_service.clone(),
        viral_service: viral_service_arc.clone(),
        db: db.clone(),
    });

    let fingerprint_repo: Arc<dyn sb_anti_cheat::FingerprintRepository> =
        Arc::new(sb_anti_cheat::SeaFingerprintRepository { db: db.clone() });
    let anti_cheat_state = Arc::new(anti_cheat_routes::AntiCheatState { fingerprint_repo });

    let rest_router = create_router(app_state.clone())
        .merge(player_stats_routes(stats_repo.clone(), user_repo.clone()));

    let hand_count_observer: Arc<dyn HandCountObserver + Send + Sync> = viral_service_arc.clone();
    let replay_observer: Arc<dyn ReplayCardObserver + Send + Sync> = viral_service_arc.clone();

    let viral_event_rx = registry.event_sender().subscribe();
    viral_observer::spawn_viral_observer(
        viral_event_rx,
        hand_count_observer,
        replay_observer,
        mission_service,
        is_bot_cache.clone(),
    );

    let ws_router = ws_route(
        auth_authenticator.clone(),
        registry.clone(),
        user_repo.clone(),
    );

    let cors_origins_env = std::env::var("CORS_ORIGINS")
        .unwrap_or_else(|_| "http://localhost:5173,http://localhost:5174".to_string());
    let allowed_origins: Vec<axum::http::HeaderValue> = cors_origins_env
        .split(',')
        .filter_map(|s| s.parse().ok())
        .collect();
    let cors = CorsLayer::new()
        .allow_origin(allowed_origins.clone())
        .allow_credentials(true)
        .allow_methods([Method::GET, Method::POST, Method::OPTIONS])
        .allow_headers([header::CONTENT_TYPE, header::COOKIE, header::AUTHORIZATION])
        .max_age(Duration::from_secs(86400));

    let archive_state = Arc::new(hand_archive::ArchiveState {
        db: db.clone(),
        r2: r2.clone(),
    });

    let metrics_route = axum::Router::new().route("/metrics", axum::routing::get(metrics_handler));

    let mission_router = sb_mission::mission_routes(Arc::new(db.clone()), user_svc.clone());

    let club_state = ClubState {
        service: app_state.club_service.clone(),
    };
    let club_router =
        club_router(club_state).layer(axum::middleware::from_fn(auth_middleware_with_context));

    let app = Router::new()
        .merge(metrics_route)
        .merge(rest_router)
        .merge(ws_router)
        .merge(auth_router(auth_service.clone()))
        .merge(sb_bot_handler::attach(bot_state))
        .merge(sb_rest_router::oracle_routes(oracle_service))
        .merge(hand_archive::router(archive_state.clone()))
        .merge(anti_cheat_routes::router(anti_cheat_state.clone()))
        .merge(tournament_router)
        .merge(season_card::router(db.clone()))
        .merge(club_tournament_router)
        .merge(mission_router)
        .merge(notification_routes(Arc::new(sb_rest_router::notification_routes::NotificationState {
            db: db.clone(),
            vapid_public_key: std::env::var("VAPID_PUBLIC_KEY").unwrap_or_default(),
        })))
        .merge(club_router)
        .layer(axum::Extension(app_state.clone()))
        .merge(sb_rest_router::analytics_routes::analytics_routes())
        .layer(
            tower::ServiceBuilder::new()
                .layer(NewSentryLayer::<axum::http::Request<axum::body::Body>>::new_from_top())
                .layer(SentryHttpLayer::new().enable_transaction()),
        )
        .layer(axum::extract::DefaultBodyLimit::max(1024 * 1024 * 10))
        .layer(middleware::from_fn(request_context_middleware))
        .layer(Extension(auth_service.clone()))
        .layer(cors)
        .layer(CookieManagerLayer::new());

    let port = std::env::var("PORT").unwrap_or_else(|_| "3000".to_string());
    let bind_addr = format!("0.0.0.0:{}", port);
    let listener = tokio::net::TcpListener::bind(&bind_addr)
        .await
        .expect("failed to bind port");

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

    spawn_gdpr_scheduler(app_state);

    let app = app.layer(CompressionLayer::new()).layer(rate_limit_layer());
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
                    record.name.clone(),
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
                    record.name.clone(),
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
                            use sb_db_entities::push_subscription::{Entity, Column};
                            let _ = Entity::delete_many().filter(Column::UserId.eq(req.user_id)).exec(&state.db).await;
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

use prometheus::{Encoder, TextEncoder};
use sentry::integrations::tower::{NewSentryLayer, SentryHttpLayer};

async fn metrics_handler() -> String {
    let encoder = TextEncoder::new();
    let metric_families = prometheus::gather();
    let mut buffer = Vec::new();
    encoder.encode(&metric_families, &mut buffer).unwrap();
    String::from_utf8(buffer).unwrap()
}

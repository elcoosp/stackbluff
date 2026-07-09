use axum::http::StatusCode;
use axum_test::TestServer;
use sb_contracts::CreateTableInput;
use sb_contracts::HandHistoryRepository;
use sb_contracts::leaderboard::LeaderboardQuery;
use sb_contracts::lobby_api::{TableInfo, TableRepo, TableService};
use sb_rest_router::create_router;
use sb_auth::{AuthServiceImpl, SharedAuthService};
use sb_auth::config::AuthConfig;
use sb_shared_types::{AppError, RequestContext, StakeLevel, TableId, UserId};
use uuid::Uuid;
use sb_table_registry::Registry;
use std::sync::Arc;

// Dummy implementations for repos and services.

struct DummyStatsRepo;
#[async_trait::async_trait]
impl sb_contracts::stats_api::PlayerStatsRepo for DummyStatsRepo {
    async fn get(
        &self,
        _user_id: &str,
    ) -> Result<
        sb_shared_types::player_stats::PlayerStatsDto,
        sb_contracts::repo_api::PersistenceError,
    > {
        Ok(Default::default())
    }
    async fn apply_delta(
        &self,
        _delta: sb_shared_types::player_stats::StatsDelta,
    ) -> Result<(), sb_contracts::repo_api::PersistenceError> {
        Ok(())
    }
}

// Dummy services for new AppState fields
use sb_contracts::notification_api::NotificationService;
use sb_contracts::tournament_api::TournamentService;
use sb_contracts::service_api::{MissionApi, ViralService};

struct DummyNotificationService;
#[async_trait::async_trait]
impl NotificationService for DummyNotificationService {
    async fn send_telegram_message(&self, _chat_id: i64, _text: String, _keyboard: Option<serde_json::Value>) -> Result<(), sb_contracts::notification_api::NotificationError> {
        Ok(())
    }
    async fn send_telegram_message_to_user(&self, _user_id: UserId, _text: String, _keyboard: Option<serde_json::Value>) -> Result<(), sb_contracts::notification_api::NotificationError> {
        Ok(())
    }
    async fn answer_callback_query(&self, _callback_query_id: String, _text: Option<String>) -> Result<(), sb_contracts::notification_api::NotificationError> {
        Ok(())
    }
}

struct DummyTournamentService;
#[async_trait::async_trait]
impl TournamentService for DummyTournamentService {
    async fn create_tournament(&self, _ctx: &RequestContext, _config: sb_contracts::tournament_api::TournamentConfig) -> Result<sb_shared_types::TournamentId, AppError> { unimplemented!() }
    async fn register(&self, _ctx: &RequestContext, _tournament_id: sb_shared_types::TournamentId, _user_id: UserId) -> Result<(), AppError> { unimplemented!() }
    async fn unregister(&self, _ctx: &RequestContext, _tournament_id: sb_shared_types::TournamentId, _user_id: UserId) -> Result<(), AppError> { unimplemented!() }
    async fn get_tournament(&self, _ctx: &RequestContext, _tournament_id: sb_shared_types::TournamentId) -> Result<sb_contracts::tournament_api::TournamentSummary, AppError> { unimplemented!() }
    async fn list_tournaments(&self, _ctx: &RequestContext, _type_filter: Option<sb_contracts::tournament_api::TournamentType>, _status_filter: Option<sb_contracts::tournament_api::TournamentStatus>) -> Result<Vec<sb_contracts::tournament_api::TournamentSummary>, AppError> { unimplemented!() }
    async fn get_results(&self, _ctx: &RequestContext, _tournament_id: sb_shared_types::TournamentId) -> Result<Vec<sb_contracts::tournament_api::TournamentResult>, AppError> { unimplemented!() }
    async fn get_my_table(&self, _ctx: &RequestContext, _tournament_id: sb_shared_types::TournamentId, _user_id: UserId) -> Result<Option<TableId>, AppError> { unimplemented!() }
}

struct DummyMissionService;
#[async_trait::async_trait]
impl MissionApi for DummyMissionService {
    async fn on_hand_completed(&self, _ctx: &RequestContext, _hand_result: &sb_shared_types::game_types::HandResult) -> Result<(), AppError> { unimplemented!() }
    async fn on_share_created(&self, _ctx: &RequestContext, _share_type: &str) -> Result<(), AppError> { unimplemented!() }
    async fn get_today_missions(&self, _ctx: &RequestContext) -> Result<Vec<sb_shared_types::missions::Mission>, AppError> { unimplemented!() }
    async fn reroll_mission(&self, _ctx: &RequestContext, _mission_id: sb_shared_types::missions::MissionId) -> Result<sb_shared_types::missions::Mission, AppError> { unimplemented!() }
    async fn claim_daily_reward(&self, _ctx: &RequestContext) -> Result<sb_contracts::service_api::ClaimResult, AppError> { unimplemented!() }
}

struct DummyViralService;
#[async_trait::async_trait]
impl ViralService for DummyViralService {
    async fn generate_replay_card(&self, _hand_result: &sb_shared_types::game_types::HandResult, _winner_id: UserId, _table_id: TableId) -> Result<sb_contracts::service_api::ReplayCard, AppError> { unimplemented!() }
    async fn record_referral(&self, _referrer_id: UserId, _referred_id: UserId) -> Result<(), AppError> { unimplemented!() }
    async fn on_hand_completed(&self, _user_id: UserId) -> Result<(), AppError> { unimplemented!() }
    async fn get_referral_stats(&self, _user_id: UserId) -> Result<sb_contracts::service_api::ReferralStats, AppError> { unimplemented!() }
}

// Mock TableRepo
mockall::mock! {
    pub TableRepo { }
    #[async_trait::async_trait]
    impl TableRepo for TableRepo {
        async fn list_tables(&self) -> Result<Vec<TableInfo>, AppError>;
        async fn create_table(&self, name: Option<String>, stake_level: StakeLevel, max_players: u32) -> Result<TableId, AppError>;
    }
}

// Mock TableService
mockall::mock! {
    pub TableService { }
    #[async_trait::async_trait]
    impl TableService for TableService {
        async fn create_table(
            &self,
            _ctx: &RequestContext,
            _input: CreateTableInput,
        ) -> Result<TableId, AppError>;
        async fn create_cash_table(
            &self,
            _stake_level: StakeLevel,
            _max_players: u32,
            _created_by: UserId,
            _chat_id: Option<String>,
        ) -> Result<TableId, AppError> {
            unimplemented!()
        }
    }
}

mockall::mock! {
    pub HandHistoryRepo { }
    #[async_trait::async_trait]
    impl HandHistoryRepository for HandHistoryRepo {
        async fn store_hand(&self, _ctx: RequestContext, _hand_data: serde_json::Value) -> Result<(), sb_contracts::repo_api::PersistenceError> {
            Ok(())
        }
        async fn list_hand_summaries(&self, _ctx: RequestContext, _table_id: TableId, _limit: u64, _cursor: Option<sb_contracts::repo_api::HandCursor>) -> Result<sb_contracts::repo_api::HandSummaryPage, sb_contracts::repo_api::PersistenceError> {
            Ok((vec![], None))
        }
        async fn count_hand_histories(&self, _ctx: RequestContext, _table_id: TableId) -> Result<u64, sb_contracts::repo_api::PersistenceError> {
            Ok(0)
        }
        async fn count_user_hands(&self, _ctx: RequestContext, _table_id: TableId, _user_id: UserId) -> Result<u64, sb_contracts::repo_api::PersistenceError> {
            Ok(0)
        }
        async fn list_user_hands(&self, _ctx: RequestContext, _user_id: Uuid, _limit: u64, _cursor: Option<sb_contracts::repo_api::HandCursor>) -> Result<sb_contracts::repo_api::HandSummaryPage, sb_contracts::repo_api::PersistenceError> {
            Ok((vec![], None))
        }
    }
}

mockall::mock! {
    pub LeaderboardQueryMock { }
    #[async_trait::async_trait]
    impl LeaderboardQuery for LeaderboardQueryMock {
        async fn get_global_leaderboard(&self, _offset: u64, _limit: u64) -> Result<Vec<sb_contracts::leaderboard::LeaderboardEntry>, sb_contracts::persistence_error::PersistenceError> {
            Ok(vec![])
        }
    }
}

// Dummy GdprRepo
struct DummyGdprRepo;
#[async_trait::async_trait]
impl sb_contracts::repo_api::GdprRepo for DummyGdprRepo {
    async fn request_deletion(&self, _user_id: uuid::Uuid) -> Result<(), sb_contracts::repo_api::PersistenceError> {
        Ok(())
    }
    async fn get_pending_deletions(&self, _older_than_days: i64) -> Result<Vec<sb_contracts::repo_api::DeletionRequestDto>, sb_contracts::repo_api::PersistenceError> {
        Ok(vec![])
    }
    async fn mark_deletion_completed(&self, _user_id: uuid::Uuid) -> Result<(), sb_contracts::repo_api::PersistenceError> {
        Ok(())
    }
    async fn get_user_data(&self, _user_id: uuid::Uuid) -> Result<sb_contracts::repo_api::UserDataExportDto, sb_contracts::repo_api::PersistenceError> {
        Ok(sb_contracts::repo_api::UserDataExportDto {
            profile: serde_json::Value::Null,
            hand_history: serde_json::Value::Null,
            missions: serde_json::Value::Null,
        })
    }
    async fn anonymize_user(&self, _user_id: uuid::Uuid) -> Result<(), sb_contracts::repo_api::PersistenceError> {
        Ok(())
    }
    async fn invalidate_sessions(&self, _user_id: uuid::Uuid) -> Result<(), sb_contracts::repo_api::PersistenceError> {
        Ok(())
    }
    async fn get_user_password_hash(&self, _user_id: uuid::Uuid) -> Result<String, sb_contracts::repo_api::PersistenceError> {
        Ok("".to_string())
    }
}

#[tokio::test]
async fn test_unauthenticated_returns_401() {
    let mock_service = MockTableService::new();
    let mock_repo = MockTableRepo::new();

    let stats_repo = Arc::new(DummyStatsRepo);
    let registry = Arc::new(Registry::new(stats_repo));

    let hand_history_repo = Arc::new(MockHandHistoryRepo::new());
    let leaderboard_query = Arc::new(MockLeaderboardQueryMock::new());
    let badge_repo = Arc::new(sb_contracts::repo_api::NoopBadgeRepo);
    let gdpr_repo = Arc::new(DummyGdprRepo);

    // Build ClubRepo stub (needed for AppState)
    let club_repo = Arc::new(sb_db_repos::club_repo::ClubRepoImpl::new(
        sea_orm::Database::connect("sqlite::memory:").await.unwrap(),
    ));
    let club_service: Arc<dyn sb_contracts::service_api::ClubService + Send + Sync> =
        Arc::new(sb_club::ClubServiceImpl::new(club_repo));

    let broker = Arc::new(sb_table_registry::connection_broker::ConnectionBroker::new());

    let notification_service = Arc::new(DummyNotificationService);
    let tournament_service = Arc::new(DummyTournamentService);
    let mission_service = Arc::new(DummyMissionService);
    let viral_service = Arc::new(DummyViralService);

    let state = Arc::new(sb_rest_router::AppState {
        notification_service: notification_service,
        tournament_service: tournament_service,
        mission_service: mission_service,
        viral_service: viral_service,
        table_service: Arc::new(mock_service),
        table_repo: Arc::new(mock_repo),
        registry: registry,
        hand_history_repo: hand_history_repo,
        leaderboard_query: leaderboard_query,
        club_service: club_service,
        broker: broker,
        badge_repo: badge_repo,
        gdpr_repo: gdpr_repo,
    });

    
    // Create a dummy auth service for the middleware
    let auth_config = AuthConfig::from_env();
    let user_repo = Arc::new(sb_db_repos::user_repo::UserRepoImpl::new(tokio::sync::mpsc::unbounded_channel().0));
    let auth_impl = Arc::new(AuthServiceImpl::new(user_repo, auth_config));
    let auth_service: SharedAuthService = auth_impl;
    let app = create_router(state)
        .layer(axum::middleware::from_fn(move |mut req: axum::extract::Request, next: axum::middleware::Next| {
            req.extensions_mut().insert(auth_service.clone());
            next.run(req)
        }));


    let server = TestServer::new(app);
    let resp = server.get("/lobby").await;
    assert_eq!(resp.status_code(), StatusCode::UNAUTHORIZED);
}

use std::sync::Arc;
use chrono::Utc;
use async_trait::async_trait;
use sb_contracts::tournament_api::{
    TournamentConfig, TournamentRepo, TournamentService, TournamentSummary,
    TournamentResult, TournamentType, TournamentId
};
use sb_contracts::notification_api::{NotificationService, ClubNotifier};
use sb_contracts::repo_api::UserRepo;
use sb_shared_types::{AppError, RequestContext, UserId, TableId};
use sb_table_registry::registry::Registry;
use sb_table_registry::connection_broker::ConnectionBroker;

pub struct TournamentServiceImpl {
    repo: Arc<dyn TournamentRepo>,
    user_repo: Arc<dyn UserRepo>,
    registry: Arc<Registry>,
    broker: Arc<ConnectionBroker>,
    notification_service: Arc<dyn NotificationService>,
    bot_handler: Option<Arc<dyn sb_contracts::notification_api::ClubNotifier>>,
    app_base_url: String,
}

impl TournamentServiceImpl {
    pub fn new(
        repo: Arc<dyn TournamentRepo>,
        user_repo: Arc<dyn UserRepo>,
        registry: Arc<Registry>,
        broker: Arc<ConnectionBroker>,
        notification_service: Arc<dyn NotificationService>,
        bot_handler: Option<Arc<dyn sb_contracts::notification_api::ClubNotifier>>,
        app_base_url: String,
    ) -> Self {
        Self {
            repo,
            user_repo,
            registry,
            broker,
            notification_service,
            bot_handler,
            app_base_url,
        }
    }
}

#[async_trait]
impl TournamentService for TournamentServiceImpl {
    async fn create_tournament(
        &self,
        _ctx: &RequestContext,
        config: TournamentConfig,
    ) -> Result<TournamentId, AppError> {
        let id = self.repo.insert_tournament(&config).await?;
        if let Some(start) = config.scheduled_start {
            if start > Utc::now() {
                crate::reminders::schedule_reminders(
                    id,
                    start,
                    self.repo.clone(),
                    self.notification_service.clone(),
                    self.bot_handler.clone(),
                    self.app_base_url.clone(),
                );
            }
        }
        Ok(id)
    }

    async fn register(
        &self,
        _ctx: &RequestContext,
        tournament_id: TournamentId,
        user_id: UserId,
    ) -> Result<(), AppError> {
        // Placeholder for existing logic
        Ok(())
    }

    async fn unregister(
        &self,
        _ctx: &RequestContext,
        tournament_id: TournamentId,
        user_id: UserId,
    ) -> Result<(), AppError> {
        // Placeholder for existing logic
        Ok(())
    }

    async fn get_tournament(
        &self,
        _ctx: &RequestContext,
        tournament_id: TournamentId,
    ) -> Result<TournamentSummary, AppError> {
        // Placeholder for existing logic
        Err(AppError::NotFound("Not implemented".into()))
    }

    async fn list_tournaments(
        &self,
        _ctx: &RequestContext,
        type_filter: Option<TournamentType>,
    ) -> Result<Vec<TournamentSummary>, AppError> {
        // Placeholder for existing logic
        Ok(vec![])
    }

    async fn get_results(
        &self,
        _ctx: &RequestContext,
        tournament_id: TournamentId,
    ) -> Result<Vec<TournamentResult>, AppError> {
        // Placeholder for existing logic
        Ok(vec![])
    }

    async fn get_my_table(
        &self,
        _ctx: &RequestContext,
        tournament_id: TournamentId,
        user_id: UserId,
    ) -> Result<Option<TableId>, AppError> {
        // Placeholder for existing logic
        Ok(None)
    }
}

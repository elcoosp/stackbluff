use std::sync::Arc;
use chrono::Utc;
use async_trait::async_trait;
use sb_contracts::tournament_api::{
    TournamentConfig, TournamentRepo, TournamentService, TournamentSummary,
    TournamentResult, TournamentType
};
use sb_contracts::repo_api::UserRepo;
use sb_shared_types::{AppError, RequestContext, UserId, TableId, TournamentId};
use sb_table_registry::registry::Registry;
use sb_table_registry::connection_broker::ConnectionBroker;

#[allow(dead_code)]
pub struct TournamentServiceImpl {
    repo: Arc<dyn TournamentRepo>,
    user_repo: Arc<dyn UserRepo>,
    registry: Arc<Registry>,
    broker: Arc<ConnectionBroker>,
    notification_service: Arc<dyn sb_contracts::notification_api::NotificationService>,
    club_notifier: Option<Arc<dyn sb_contracts::notification_api::ClubNotifier>>,
    app_base_url: String,
}

impl TournamentServiceImpl {
    pub fn new(
        repo: Arc<dyn TournamentRepo>,
        user_repo: Arc<dyn UserRepo>,
        registry: Arc<Registry>,
        broker: Arc<ConnectionBroker>,
        notification_service: Arc<dyn sb_contracts::notification_api::NotificationService>,
        club_notifier: Option<Arc<dyn sb_contracts::notification_api::ClubNotifier>>,
        app_base_url: String,
    ) -> Self {
        Self {
            repo,
            user_repo,
            registry,
            broker,
            notification_service,
            club_notifier,
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
        if let Some(start) = config.scheduled_start
            && start > Utc::now()
        {
            crate::reminders::schedule_reminders(
                id,
                start,
                self.repo.clone(),
                self.notification_service.clone(),
                self.club_notifier.clone(),
                self.app_base_url.clone(),
            );
        }
        Ok(id)
    }

    async fn register(
        &self,
        _ctx: &RequestContext,
        _tournament_id: TournamentId,
        _user_id: UserId,
    ) -> Result<(), AppError> {
        Ok(())
    }

    async fn unregister(
        &self,
        _ctx: &RequestContext,
        _tournament_id: TournamentId,
        _user_id: UserId,
    ) -> Result<(), AppError> {
        Ok(())
    }

    async fn get_tournament(
        &self,
        _ctx: &RequestContext,
        _tournament_id: TournamentId,
    ) -> Result<TournamentSummary, AppError> {
        Err(AppError::NotFound("Not implemented".into()))
    }

    async fn list_tournaments(
        &self,
        _ctx: &RequestContext,
        _type_filter: Option<TournamentType>,
    ) -> Result<Vec<TournamentSummary>, AppError> {
        Ok(vec![])
    }

    async fn get_results(
        &self,
        _ctx: &RequestContext,
        _tournament_id: TournamentId,
    ) -> Result<Vec<TournamentResult>, AppError> {
        Ok(vec![])
    }

    async fn get_my_table(
        &self,
        _ctx: &RequestContext,
        _tournament_id: TournamentId,
        _user_id: UserId,
    ) -> Result<Option<TableId>, AppError> {
        Ok(None)
    }
}

impl TournamentServiceImpl {
    pub fn register_sit_go(&self, _tournament_id: sb_shared_types::TournamentId, _cmd_tx: tokio::sync::mpsc::Sender<crate::SitGoCommand>) {
        // Stub implementation
    }

    pub fn register_mtt(&self, _tournament_id: sb_shared_types::TournamentId, _cmd_tx: tokio::sync::mpsc::Sender<crate::MttCommand>) {
        // Stub implementation
    }
}

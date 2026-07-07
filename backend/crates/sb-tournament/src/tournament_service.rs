use async_trait::async_trait;
use chrono::Utc;
use dashmap::DashMap;
use sb_contracts::repo_api::UserRepo;
use sb_contracts::tournament_api::{
    TournamentConfig, TournamentRepo, TournamentResult, TournamentService, TournamentSummary,
    TournamentType, TournamentStatus,
};
use sb_shared_types::{AppError, RequestContext, TableId, TournamentId, UserId};
use sb_table_registry::connection_broker::ConnectionBroker;
use sb_table_registry::registry::Registry;
use std::sync::Arc;
use tokio::sync::{mpsc, oneshot};
use tracing::{error, info};

use crate::{MttCommand, MttDirector, SitGoCommand, SitGoTournament};

#[derive(Clone)]
pub struct TournamentServiceImpl {
    repo: Arc<dyn TournamentRepo>,
    user_repo: Arc<dyn UserRepo>,
    registry: Arc<Registry>,
    broker: Arc<ConnectionBroker>,
    notification_service: Arc<dyn sb_contracts::notification_api::NotificationService>,
    club_notifier: Option<Arc<dyn sb_contracts::notification_api::ClubNotifier>>,
    app_base_url: String,
    sit_go_actors: Arc<DashMap<TournamentId, mpsc::Sender<SitGoCommand>>>,
    mtt_actors: Arc<DashMap<TournamentId, mpsc::Sender<MttCommand>>>,
    club_repo: Option<Arc<dyn sb_contracts::ClubRepo>>,
    club_service: Option<Arc<dyn sb_contracts::ClubService>>,
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
            sit_go_actors: Arc::new(DashMap::new()),
            mtt_actors: Arc::new(DashMap::new()),
            club_repo: None,
            club_service: None,
        }
    }

    pub fn register_sit_go(&self, id: TournamentId, tx: mpsc::Sender<SitGoCommand>) {
        self.sit_go_actors.insert(id, tx);
    }

    pub fn register_mtt(&self, id: TournamentId, tx: mpsc::Sender<MttCommand>) {
        self.mtt_actors.insert(id, tx);
    }

    pub fn set_club_repo(&mut self, repo: Arc<dyn sb_contracts::ClubRepo>) {
        self.club_repo = Some(repo);
    }

    pub fn set_club_service(&mut self, service: Arc<dyn sb_contracts::ClubService>) {
        self.club_service = Some(service);
    }

    pub fn remove_actor(&self, id: TournamentId) {
        self.sit_go_actors.remove(&id);
        self.mtt_actors.remove(&id);
    }

    fn get_sender(
        &self,
        id: TournamentId,
    ) -> Result<
        (
            mpsc::Sender<SitGoCommand>,
            mpsc::Sender<MttCommand>,
            TournamentType,
        ),
        AppError,
    > {
        let sit = self.sit_go_actors.get(&id);
        let mtt = self.mtt_actors.get(&id);
        match (sit, mtt) {
            (Some(s), _) => Ok((
                s.value().clone(),
                mpsc::channel(1).0,
                TournamentType::SitAndGo,
            )),
            (None, Some(m)) => Ok((mpsc::channel(1).0, m.value().clone(), TournamentType::Mtt)),
            (None, None) => Err(AppError::NotFound("Tournament not found".into())),
        }
    }

    /// Post results to Telegram using the main notification service.
    pub async fn post_tournament_results(
        &self,
        tournament_id: TournamentId,
        club_repo: &Arc<dyn sb_contracts::ClubRepo>,
    ) -> Result<(), AppError> {
        let results = self.repo.list_results(tournament_id).await?;
        let tournament = self
            .repo
            .get_tournament(tournament_id)
            .await?
            .ok_or_else(|| AppError::NotFound("Tournament not found".into()))?;

        let club_id = tournament
            .config
            .club_id
            .ok_or_else(|| AppError::Internal("Not a club tournament".into()))?;

        let telegram_chat_id = club_repo
            .get_telegram_chat_id(club_id)
            .await
            .map_err(|e| AppError::Internal(e.to_string()))?;

        if let Some(chat_id) = telegram_chat_id {
            let mut message = "🏆 *Tournament Results*\n\n".to_string();

            for (idx, result) in results.iter().take(3).enumerate() {
                let medal = match idx {
                    0 => "🥇",
                    1 => "🥈",
                    2 => "🥉",
                    _ => "",
                };
                message += &format!(
                    "{} Position {}: User {} - Prize: {}\n",
                    medal, result.position, result.user_id, result.prize
                );
            }

            self.notification_service
                .send_telegram_message(chat_id, message, None)
                .await
                .map_err(|e| AppError::Internal(e.to_string()))?;

            info!(%tournament_id, %chat_id, "Posted tournament results to Telegram");
        }

        Ok(())
    }

    pub async fn award_tournament_xp(&self, tournament_id: TournamentId) -> Result<(), AppError> {
        let tournament = self
            .repo
            .get_tournament(tournament_id)
            .await?
            .ok_or_else(|| AppError::NotFound("Tournament not found".into()))?;

        let club_id = tournament
            .config
            .club_id
            .ok_or_else(|| AppError::Internal("Not a club tournament".into()))?;

        let registrations = self.repo.list_registrations(tournament_id).await?;
        let xp_per_player = 50;

        let club_service = self
            .club_service
            .as_ref()
            .ok_or_else(|| AppError::Configuration("Club service not configured".into()))?;

        for reg in &registrations {
            let ctx = RequestContext {
                request_id: uuid::Uuid::new_v4(),
                user_id: Some(reg.user_id),
                ip: String::new(),
            };

            club_service
                .add_xp(&ctx, club_id, reg.user_id, xp_per_player)
                .await
                .map_err(|e| AppError::Internal(e.to_string()))?;
        }

        info!(%tournament_id, "Awarded XP to {} participants", registrations.len());
        Ok(())
    }

    pub async fn handle_tournament_completion(
        &self,
        tournament_id: TournamentId,
    ) -> Result<(), AppError> {
        info!(%tournament_id, "Handling tournament completion");

        let tournament = self
            .repo
            .get_tournament(tournament_id)
            .await?
            .ok_or_else(|| AppError::NotFound("Tournament not found".into()))?;

        if let Some(club_id) = tournament.config.club_id {
            if let Some(club_repo) = &self.club_repo {
                if let Err(e) = self.post_tournament_results(tournament_id, club_repo).await {
                    error!(%tournament_id, error = ?e, "Failed to post tournament results");
                }
                if let Err(e) = self.award_tournament_xp(tournament_id).await {
                    error!(%tournament_id, error = ?e, "Failed to award tournament XP");
                }
            }
            info!(%tournament_id, %club_id, "Club tournament completed");
        }

        Ok(())
    }
}

#[async_trait]
impl TournamentService for TournamentServiceImpl {
    async fn create_tournament(
        &self,
        ctx: &RequestContext,
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
        let created_by = ctx
            .user_id
            .unwrap_or_else(|| UserId::new(uuid::Uuid::nil()));
        let chat_id = None;

        // Spawn actor and completion handler inline
        let repo = self.repo.clone();
        let user_repo = self.user_repo.clone();
        let (completion_tx, completion_rx) = oneshot::channel();

        match config.tournament_type {
            TournamentType::SitAndGo => {
                let (tx, rx) = mpsc::channel(32);
                let actor = SitGoTournament::new(
                    id,
                    config.clone(),
                    self.registry.clone(),
                    self.broker.clone(),
                    rx,
                    self.registry.event_sender().subscribe(),
                    created_by,
                    chat_id.clone(),
                    Some(completion_tx),
                );
                let handle = tokio::spawn(actor.run());
                self.sit_go_actors.insert(id, tx.clone());
                tokio::spawn(async move {
                    let _ = handle.await;
                });
                let _ = tx
                    .send(SitGoCommand::SetRepoHandle {
                        repo: repo.clone(),
                        user_repo: user_repo.clone(),
                    })
                    .await;
            }
            TournamentType::Mtt => {
                let (tx, rx) = mpsc::channel(32);
                let actor = MttDirector::new(
                    id,
                    config.clone(),
                    self.registry.clone(),
                    self.broker.clone(),
                    rx,
                    self.registry.event_sender().subscribe(),
                    created_by,
                    chat_id.clone(),
                    Some(completion_tx),
                );
                let handle = tokio::spawn(actor.run());
                self.mtt_actors.insert(id, tx.clone());
                tokio::spawn(async move {
                    let _ = handle.await;
                });
                let _ = tx
                    .send(MttCommand::SetRepoHandle {
                        repo: repo.clone(),
                        user_repo: user_repo.clone(),
                    })
                    .await;
            }
        }

        // Spawn completion handler
        let service = Arc::new(self.clone());
        tokio::spawn(async move {
            let _ = completion_rx.await;
            if let Err(e) = service.handle_tournament_completion(id).await {
                error!(%id, error = ?e, "Tournament completion handler failed");
            }
        });

        info!(
            tournament_id = %id,
            tournament_type = ?config.tournament_type,
            max_players = config.max_players,
            buy_in = config.buy_in.as_i64(),
            "tournament created and actor spawned"
        );
        Ok(id)
    }

    async fn register(
        &self,
        _ctx: &RequestContext,
        tournament_id: TournamentId,
        user_id: UserId,
    ) -> Result<(), AppError> {
        // Check if this is a club tournament
        let tournament = self.repo.get_tournament(tournament_id).await?;
        if let Some(t) = tournament
            && let Some(club_id) = t.config.club_id
            && let Some(club_repo) = &self.club_repo
        {
            let is_member = club_repo
                .is_member(club_id, user_id)
                .await
                .map_err(|e| AppError::Internal(e.to_string()))?;
            if !is_member {
                return Err(AppError::Internal("Not a club member".into()));
            }
        }

        let (sit_tx, mtt_tx, typ) = self.get_sender(tournament_id)?;
        let (rtx, rrx) = tokio::sync::oneshot::channel();

        match typ {
            TournamentType::SitAndGo => {
                sit_tx
                    .send(SitGoCommand::Register {
                        user_id,
                        respond_to: rtx,
                    })
                    .await
                    .map_err(|_| AppError::Internal("actor dropped".into()))?;
            }
            TournamentType::Mtt => {
                mtt_tx
                    .send(MttCommand::Register {
                        user_id,
                        respond_to: rtx,
                    })
                    .await
                    .map_err(|_| AppError::Internal("actor dropped".into()))?;
            }
        }

        rrx.await
            .map_err(|_| AppError::Internal("response dropped".into()))?
    }

    async fn unregister(
        &self,
        _ctx: &RequestContext,
        tournament_id: TournamentId,
        user_id: UserId,
    ) -> Result<(), AppError> {
        let (sit_tx, mtt_tx, typ) = self.get_sender(tournament_id)?;
        let (rtx, rrx) = tokio::sync::oneshot::channel();

        match typ {
            TournamentType::SitAndGo => {
                sit_tx
                    .send(SitGoCommand::Unregister {
                        user_id,
                        respond_to: rtx,
                    })
                    .await
                    .map_err(|_| AppError::Internal("actor dropped".into()))?;
            }
            TournamentType::Mtt => {
                mtt_tx
                    .send(MttCommand::Unregister {
                        user_id,
                        respond_to: rtx,
                    })
                    .await
                    .map_err(|_| AppError::Internal("actor dropped".into()))?;
            }
        }

        rrx.await
            .map_err(|_| AppError::Internal("response dropped".into()))?
    }

    async fn get_tournament(
        &self,
        _ctx: &RequestContext,
        tournament_id: TournamentId,
    ) -> Result<TournamentSummary, AppError> {
        let (sit_tx, mtt_tx, typ) = self.get_sender(tournament_id)?;
        let (rtx, rrx) = tokio::sync::oneshot::channel();

        match typ {
            TournamentType::SitAndGo => {
                sit_tx
                    .send(SitGoCommand::GetSummary { respond_to: rtx })
                    .await
                    .map_err(|_| AppError::Internal("actor dropped".into()))?;
            }
            TournamentType::Mtt => {
                mtt_tx
                    .send(MttCommand::GetSummary { respond_to: rtx })
                    .await
                    .map_err(|_| AppError::Internal("actor dropped".into()))?;
            }
        }

        rrx.await
            .map_err(|_| AppError::Internal("response dropped".into()))
    }

    async fn list_tournaments(
        &self,
        _ctx: &RequestContext,
        type_filter: Option<TournamentType>,
    ) -> Result<Vec<TournamentSummary>, AppError> {
        let records = self.repo.list_tournaments(type_filter).await?;
        let mut summaries = Vec::new();
        for r in records {
            summaries.push(TournamentSummary {
                id: r.id,
                tournament_type: r.config.tournament_type,
                status: r.status,
                registered: 0,
                max_players: r.config.max_players,
                buy_in: r.config.buy_in,
                prize_pool: r.prize_pool,
                current_blind_level: None,
                started_at: r.started_at,
            });
        }
        Ok(summaries)
    }

    async fn get_results(
        &self,
        _ctx: &RequestContext,
        tournament_id: TournamentId,
    ) -> Result<Vec<TournamentResult>, AppError> {
        self.repo.list_results(tournament_id).await
    }

    async fn get_my_table(
        &self,
        _ctx: &RequestContext,
        tournament_id: TournamentId,
        user_id: UserId,
    ) -> Result<Option<TableId>, AppError> {
        let (sit_tx, mtt_tx, typ) = self.get_sender(tournament_id)?;
        let (rtx, rrx) = tokio::sync::oneshot::channel();

        match typ {
            TournamentType::SitAndGo => {
                sit_tx
                    .send(SitGoCommand::GetMyTable {
                        user_id,
                        respond_to: rtx,
                    })
                    .await
                    .map_err(|_| AppError::Internal("actor dropped".into()))?;
            }
            TournamentType::Mtt => {
                mtt_tx
                    .send(MttCommand::GetMyTable {
                        user_id,
                        respond_to: rtx,
                    })
                    .await
                    .map_err(|_| AppError::Internal("actor dropped".into()))?;
            }
        }

        rrx.await
            .map_err(|_| AppError::Internal("response dropped".into()))
    }
}

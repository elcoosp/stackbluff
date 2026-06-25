use crate::mtt_director::MttCommand;
use crate::sit_go_tournament::SitGoCommand;
use dashmap::DashMap;
use sb_contracts::tournament_api::{
    TournamentConfig, TournamentRepo, TournamentResult, TournamentService, TournamentSummary,
    TournamentType,
};
use sb_shared_types::{AppError, RequestContext, TournamentId, UserId};
use std::sync::Arc;
use tokio::sync::mpsc;
use tracing::info;

pub struct TournamentServiceImpl {
    repo: Arc<dyn TournamentRepo>,
    sit_go_actors: Arc<DashMap<TournamentId, mpsc::Sender<SitGoCommand>>>,
    mtt_actors: Arc<DashMap<TournamentId, mpsc::Sender<MttCommand>>>,
}

impl TournamentServiceImpl {
    pub fn new(repo: Arc<dyn TournamentRepo>) -> Self {
        Self {
            repo,
            sit_go_actors: Arc::new(DashMap::new()),
            mtt_actors: Arc::new(DashMap::new()),
        }
    }

    pub fn register_sit_go(&self, id: TournamentId, tx: mpsc::Sender<SitGoCommand>) {
        self.sit_go_actors.insert(id, tx);
    }

    pub fn register_mtt(&self, id: TournamentId, tx: mpsc::Sender<MttCommand>) {
        self.mtt_actors.insert(id, tx);
    }

    pub fn remove_actor(&self, id: TournamentId) {
        self.sit_go_actors.remove(&id);
        self.mtt_actors.remove(&id);
    }

    fn sit_go_tx(&self, id: TournamentId) -> Result<mpsc::Sender<SitGoCommand>, AppError> {
        self.sit_go_actors
            .get(&id)
            .map(|r| r.value().clone())
            .ok_or_else(|| AppError::NotFound("Tournament not found".into()))
    }
}

#[async_trait::async_trait]
impl TournamentService for TournamentServiceImpl {
    async fn create_tournament(
        &self,
        _ctx: &RequestContext,
        config: TournamentConfig,
    ) -> Result<TournamentId, AppError> {
        let id = self.repo.insert_tournament(&config).await?;
        info!(tournament_id = %id, tournament_type = ?config.tournament_type, max_players = config.max_players, buy_in = config.buy_in.as_i64(), "tournament created");
        Ok(id)
    }

    async fn register(
        &self,
        _ctx: &RequestContext,
        tournament_id: TournamentId,
        user_id: UserId,
    ) -> Result<(), AppError> {
        let tx = self.sit_go_tx(tournament_id)?;
        let (rtx, rrx) = tokio::sync::oneshot::channel();
        tx.send(SitGoCommand::Register {
            user_id,
            respond_to: rtx,
        })
        .await
        .map_err(|_| AppError::Internal("actor dropped".into()))?;
        rrx.await
            .map_err(|_| AppError::Internal("response dropped".into()))?
    }

    async fn unregister(
        &self,
        _ctx: &RequestContext,
        tournament_id: TournamentId,
        user_id: UserId,
    ) -> Result<(), AppError> {
        let tx = self.sit_go_tx(tournament_id)?;
        let (rtx, rrx) = tokio::sync::oneshot::channel();
        tx.send(SitGoCommand::Unregister {
            user_id,
            respond_to: rtx,
        })
        .await
        .map_err(|_| AppError::Internal("actor dropped".into()))?;
        rrx.await
            .map_err(|_| AppError::Internal("response dropped".into()))?
    }

    async fn get_tournament(
        &self,
        _ctx: &RequestContext,
        tournament_id: TournamentId,
    ) -> Result<TournamentSummary, AppError> {
        let tx = self.sit_go_tx(tournament_id)?;
        let (rtx, rrx) = tokio::sync::oneshot::channel();
        tx.send(SitGoCommand::GetSummary { respond_to: rtx })
            .await
            .map_err(|_| AppError::Internal("actor dropped".into()))?;
        rrx.await
            .map_err(|_| AppError::Internal("response dropped".into()))
    }

    async fn list_tournaments(
        &self,
        _ctx: &RequestContext,
        type_filter: Option<TournamentType>,
    ) -> Result<Vec<TournamentSummary>, AppError> {
        let records = self.repo.list_tournaments(type_filter).await?;
        Ok(records
            .into_iter()
            .map(|r| TournamentSummary {
                id: r.id,
                tournament_type: r.config.tournament_type,
                status: r.status,
                registered: 0,
                max_players: r.config.max_players,
                buy_in: r.config.buy_in,
                prize_pool: r.prize_pool,
                current_blind_level: None,
                started_at: r.started_at,
            })
            .collect())
    }

    async fn get_results(
        &self,
        _ctx: &RequestContext,
        tournament_id: TournamentId,
    ) -> Result<Vec<TournamentResult>, AppError> {
        self.repo.list_results(tournament_id).await
    }
}

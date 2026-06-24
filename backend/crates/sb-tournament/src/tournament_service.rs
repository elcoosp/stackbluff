use std::sync::Arc;

use dashmap::DashMap;
use tokio::sync::mpsc;
use tracing::info;

use sb_contracts::tournament_api::{
    TournamentConfig, TournamentId, TournamentRepo, TournamentResult, TournamentService,
    TournamentSummary, TournamentType,
};
use sb_shared_types::{AppError, RequestContext, UserId};

use crate::sit_go_tournament::SitGoCommand;

/// Service that manages tournament actors and routes API calls.
pub struct TournamentServiceImpl {
    repo: Arc<dyn TournamentRepo>,
    actors: Arc<DashMap<TournamentId, mpsc::Sender<SitGoCommand>>>,
}

impl TournamentServiceImpl {
    pub fn new(repo: Arc<dyn TournamentRepo>) -> Self {
        Self {
            repo,
            actors: Arc::new(DashMap::new()),
        }
    }

    pub fn register_actor(&self, id: TournamentId, tx: mpsc::Sender<SitGoCommand>) {
        self.actors.insert(id, tx);
    }

    pub fn remove_actor(&self, id: TournamentId) {
        self.actors.remove(&id);
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
        if let Some(tx) = self.actors.get(&tournament_id) {
            let (rtx, rrx) = tokio::sync::oneshot::channel();
            tx.send(SitGoCommand::Register {
                user_id,
                respond_to: rtx,
            })
            .await
            .map_err(|_| AppError::Internal("tournament actor dropped".into()))?;
            rrx.await
                .map_err(|_| AppError::Internal("actor response dropped".into()))?
        } else {
            Err(AppError::NotFound("Tournament not found".into()))
        }
    }

    async fn unregister(
        &self,
        _ctx: &RequestContext,
        tournament_id: TournamentId,
        user_id: UserId,
    ) -> Result<(), AppError> {
        if let Some(tx) = self.actors.get(&tournament_id) {
            let (rtx, rrx) = tokio::sync::oneshot::channel();
            tx.send(SitGoCommand::Unregister {
                user_id,
                respond_to: rtx,
            })
            .await
            .map_err(|_| AppError::Internal("tournament actor dropped".into()))?;
            rrx.await
                .map_err(|_| AppError::Internal("actor response dropped".into()))?
        } else {
            Err(AppError::NotFound("Tournament not found".into()))
        }
    }

    async fn get_tournament(
        &self,
        _ctx: &RequestContext,
        tournament_id: TournamentId,
    ) -> Result<TournamentSummary, AppError> {
        if let Some(tx) = self.actors.get(&tournament_id) {
            let (rtx, rrx) = tokio::sync::oneshot::channel();
            tx.send(SitGoCommand::GetSummary { respond_to: rtx })
                .await
                .map_err(|_| AppError::Internal("tournament actor dropped".into()))?;
            rrx.await
                .map_err(|_| AppError::Internal("actor response dropped".into()))
        } else {
            Err(AppError::NotFound("Tournament not found".into()))
        }
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

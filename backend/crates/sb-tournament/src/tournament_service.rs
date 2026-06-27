use crate::mtt_director::{MttCommand, MttDirector};
use crate::sit_go_tournament::{SitGoCommand, SitGoTournament};
use dashmap::DashMap;
use sb_contracts::repo_api::UserRepo;
use sb_contracts::tournament_api::{
    TournamentConfig, TournamentRepo, TournamentResult, TournamentService, TournamentSummary,
    TournamentType,
};
use sb_shared_types::{AppError, RequestContext, TableId, TournamentId, UserId};
use sb_table_registry::connection_broker::ConnectionBroker;
use sb_table_registry::registry::Registry;
use std::sync::Arc;
use std::time::Duration;
use tokio::sync::mpsc;
use tracing::info;

pub struct TournamentServiceImpl {
    repo: Arc<dyn TournamentRepo>,
    user_repo: Arc<dyn UserRepo>,
    registry: Arc<Registry>,
    broker: Arc<ConnectionBroker>,
    sit_go_actors: Arc<DashMap<TournamentId, mpsc::Sender<SitGoCommand>>>,
    mtt_actors: Arc<DashMap<TournamentId, mpsc::Sender<MttCommand>>>,
    pub club_repo: std::sync::Arc<dyn sb_contracts::repo_api::ClubRepo>,
    pub club_service: std::sync::Arc<dyn sb_contracts::service_api::ClubService>,
    pub notification_service: std::sync::Arc<dyn sb_contracts::notification_api::NotificationService>,
}

impl TournamentServiceImpl {
    pub fn new(
        repo: Arc<dyn TournamentRepo>,
        user_repo: Arc<dyn UserRepo>,
        registry: Arc<Registry>,
        broker: Arc<ConnectionBroker>,
    ) -> Self {
        Self {
            repo,
            user_repo,
            registry,
            broker,
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

    async fn spawn_actor(&self, config: &TournamentConfig, id: TournamentId) {
        let repo = self.repo.clone();
        let user_repo = self.user_repo.clone();
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
                );
                let handle = tokio::spawn(actor.run());
                self.sit_go_actors.insert(id, tx.clone());
                tokio::spawn(async move {
                    let _ = handle.await;
                });
                // ─── Send SetRepoHandle to the actor ────────────────────
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
                );
                let handle = tokio::spawn(actor.run());
                self.mtt_actors.insert(id, tx.clone());
                tokio::spawn(async move {
                    let _ = handle.await;
                });
                // ─── Send SetRepoHandle to the actor ────────────────────
                let _ = tx
                    .send(MttCommand::SetRepoHandle {
                        repo: repo.clone(),
                        user_repo: user_repo.clone(),
                    })
                    .await;
            }
        }
    }

    /// Award XP to tournament participants after a hand completes.
    pub async fn award_xp_for_hand(
        &self,
        tournament_id: uuid::Uuid,
        participants: Vec<i64>,
        winner: Option<i64>,
    ) {
        let config = match self.get_tournament_config(tournament_id).await {
            Ok(c) => c,
            Err(_) => return,
        };
        let club_id = match config.club_id {
            Some(cid) => cid,
            None => return,
        };
        for user_id in &participants {
            let _ = self.club_service.add_xp(club_id, *user_id, 5).await;
        }
        if let Some(winner_id) = winner {
            let _ = self.club_service.add_xp(club_id, winner_id, 50).await;
        }
    }

    /// Post tournament results to the club's Telegram group.
    pub async fn post_tournament_results(
        &self,
        event: &sb_contracts::tournament_api::TournamentCompletedEvent,
    ) {
        let club_id = match event.club_id {
            Some(cid) => cid,
            None => return,
        };
        let chat_id = match self.club_repo.find_telegram_chat_id(club_id).await {
            Ok(Some(id)) => id,
            _ => return,
        };
        let message = self.build_result_message(event);
        let _ = self.notification_service
            .send_telegram_message(chat_id, &message, Some("HTML"))
            .await;
    }

    /// Build the tournament result message for Telegram.
    fn build_result_message(
        &self,
        event: &sb_contracts::tournament_api::TournamentCompletedEvent,
    ) -> String {
        let mut msg = format!("🏆 <b>Tournament Results: {}</b>\n\n", event.tournament_name);
        for ranking in event.final_rankings.iter().take(3) {
            let medal = match ranking.placement {
                1 => "🥇",
                2 => "🥈",
                3 => "🥉",
                _ => "  ",
            };
            msg.push_str(&format!(
                "{} {} - {} chips\n",
                medal, ranking.display_name, ranking.prize_amount
            ));
        }
        let base_url = std::env::var("APP_BASE_URL").unwrap_or_else(|_| "https://stackbluff.com".to_string());
        if let Some(club_id) = event.club_id {
            msg.push_str(&format!("\n🎯 Join the next tournament: {}/clubs/{}\n", base_url, club_id.0));
        }
        msg
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
        self.spawn_actor(&config, id).await;
        info!(tournament_id = %id, tournament_type = ?config.tournament_type, max_players = config.max_players, buy_in = config.buy_in.as_i64(), "tournament created and actor spawned");
        Ok(id)
    }

    async fn register(
        &self,
        _ctx: &RequestContext,
        tournament_id: TournamentId,
        user_id: UserId,
    ) -> Result<(), AppError> {
        // Check club membership if tournament is club-restricted
        let config = self.get_tournament_config(tournament_id).await?;
        if let Some(club_id) = config.club_id {
            let is_member = self.club_repo
                .is_member(club_id, user_id)
                .await
                .map_err(|e| sb_shared_types::errors::AppError::Internal(format!("Club repo error: {e}")))?;
            if !is_member {
                return Err(sb_shared_types::errors::AppError::PermissionDenied(
                    "User is not a member of the club".to_string(),
                ));
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
        let mut summaries = Vec::with_capacity(records.len());
        for r in records {
            let registered = self.repo.count_registrations(r.id).await?;
            summaries.push(TournamentSummary {
                id: r.id,
                tournament_type: r.config.tournament_type,
                status: r.status,
                registered,
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
        let timeout = Duration::from_secs(
            std::env::var("TOURNAMENT_GET_TABLE_TIMEOUT_SECS")
                .unwrap_or_else(|_| "2".to_string())
                .parse()
                .unwrap_or(2),
        );

        let result = match typ {
            TournamentType::SitAndGo => {
                sit_tx
                    .send(SitGoCommand::GetMyTable {
                        user_id,
                        respond_to: rtx,
                    })
                    .await
                    .map_err(|_| AppError::Internal("actor dropped".into()))?;
                tokio::time::timeout(timeout, rrx)
                    .await
                    .map_err(|_| AppError::Timeout)?
                    .map_err(|_| AppError::Internal("oneshot dropped".into()))?
            }
            TournamentType::Mtt => {
                mtt_tx
                    .send(MttCommand::GetMyTable {
                        user_id,
                        respond_to: rtx,
                    })
                    .await
                    .map_err(|_| AppError::Internal("actor dropped".into()))?;
                tokio::time::timeout(timeout, rrx)
                    .await
                    .map_err(|_| AppError::Timeout)?
                    .map_err(|_| AppError::Internal("oneshot dropped".into()))?
            }
        };

        match &result {
            Some(id) => tracing::info!(%tournament_id, %user_id, %id, "Table found"),
            None => tracing::info!(%tournament_id, %user_id, "No table found (not seated)"),
        }

        metrics::counter!("tournament.get_my_table.total").increment(1);
        if result.is_some() {
            metrics::counter!("tournament.get_my_table.found").increment(1);
        } else {
            metrics::counter!("tournament.get_my_table.not_found").increment(1);
        }

        Ok(result)
    }
}

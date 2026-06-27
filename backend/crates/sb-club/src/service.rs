use sb_contracts::{ClubError, ClubRepo, ClubService, LeaderboardPage};
use sb_shared_types::{ClubId, RequestContext, UserId};
use std::sync::Arc;

pub struct ClubServiceImpl {
    repo: Arc<dyn ClubRepo>,
    pub tournament_service: std::sync::Arc<dyn sb_contracts::tournament_api::TournamentService>,
}

impl ClubServiceImpl {
    pub fn new(repo: Arc<dyn ClubRepo>) -> Self {
        Self { repo }
    }
}

#[async_trait::async_trait]
impl ClubService for ClubServiceImpl {
    async fn create_club(
        &self,
        ctx: &RequestContext,
        name: &str,
        logo_url: Option<&str>,
        created_by: UserId,
    ) -> Result<ClubId, ClubError> {
        if name.trim().is_empty() {
            return Err(ClubError::validation("club name must not be empty"));
        }
        tracing::debug!(
            request_id = %ctx.request_id,
            user_id = ?ctx.user_id,
            "create_club: name={}",
            name
        );
        self.repo.create_club(name, logo_url, created_by).await
    }

    async fn join_club(
        &self,
        ctx: &RequestContext,
        club_id: ClubId,
        user_id: UserId,
    ) -> Result<(), ClubError> {
        tracing::debug!(
            request_id = %ctx.request_id,
            club_id = %club_id,
            user_id = %user_id,
            "join_club"
        );
        self.repo.join_club(club_id, user_id).await
    }

    async fn get_leaderboard(
        &self,
        _ctx: &RequestContext,
        club_id: ClubId,
        division: u32,
    ) -> Result<LeaderboardPage, ClubError> {
        let club = self.repo.find_club_by_id(club_id).await?;
        if club.is_none() {
            return Err(ClubError::not_found(club_id));
        }
        self.repo.get_leaderboard_page(club_id, division).await
    }

    async fn add_xp(
        &self,
        ctx: &RequestContext,
        club_id: ClubId,
        user_id: UserId,
        xp: i64,
    ) -> Result<(), ClubError> {
        tracing::debug!(
            request_id = %ctx.request_id,
            club_id = %club_id,
            user_id = %user_id,
            xp = xp,
            "add_xp"
        );
        self.repo.increment_weekly_xp(club_id, user_id, xp).await
    }

    /// Schedule a new tournament for a club.
    pub async fn schedule_tournament(
        &self,
        club_id: sb_shared_types::ids::ClubId,
        requester_id: i64,
        mut config: sb_contracts::tournament_api::TournamentConfig,
    ) -> Result<uuid::Uuid, sb_shared_types::errors::AppError> {
        let is_member = self
            .club_repo
            .is_member(club_id, requester_id)
            .await
            .map_err(|e| sb_shared_types::errors::AppError::Internal(format!("Club repo error: {e}")))?;

        if !is_member {
            return Err(sb_shared_types::errors::AppError::PermissionDenied(
                "User is not a member of the club".to_string(),
            ));
        }

        config.club_id = Some(club_id);
        let tournament_id = self.tournament_service.create_tournament(config).await?;
        tracing::info!(tournament_id = %tournament_id, club_id = %club_id.0, "Scheduled club tournament");
        Ok(tournament_id)
    }

    /// List all tournaments for a club.
    pub async fn list_club_tournaments(
        &self,
        club_id: sb_shared_types::ids::ClubId,
    ) -> Result<Vec<sb_contracts::tournament_api::TournamentSummary>, sb_shared_types::errors::AppError> {
        self.tournament_service.list_tournaments_by_club(club_id).await
    }

}

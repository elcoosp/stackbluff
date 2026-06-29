use sb_contracts::{ClubError, ClubRepo, ClubService, LeaderboardPage};
use sb_contracts::async_hooks::ConnectionBroker;
use sb_contracts::repo_api::{ClubProSettings, UserRepo};
use sb_shared_types::{ClubId, RequestContext, UserId};
use sb_shared_types::club_pro_settings::UpdateClubProSettingsRequest;
use std::sync::Arc;

pub struct ClubServiceImpl {
    repo: Arc<dyn ClubRepo>,
    user_repo: Arc<dyn UserRepo>,
    broker: Option<Arc<dyn ConnectionBroker>>,
}

impl ClubServiceImpl {
    pub fn new(
        repo: Arc<dyn ClubRepo>,
        user_repo: Arc<dyn UserRepo>,
        broker: Option<Arc<dyn ConnectionBroker>>,
    ) -> Self {
        Self { repo, user_repo, broker }
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

    async fn update_club_pro_settings(
        &self,
        club_id: ClubId,
        owner_id: UserId,
        request: UpdateClubProSettingsRequest,
    ) -> Result<ClubProSettings, ClubError> {
        request.validate().map_err(|e| ClubError::validation(e))?;

        let club_owner = self.repo.find_club_owner(club_id).await?;
        if club_owner != owner_id {
            return Err(ClubError::PermissionDenied);
        }

        let is_pro = self.user_repo.is_club_pro_active(owner_id).await
            .map_err(|e| ClubError::Internal(e.to_string()))?;
        if !is_pro {
            return Err(ClubError::PermissionDenied);
        }

        let settings = ClubProSettings {
            banner_url: request.banner_url,
            chip_preset_id: request.chip_preset_id.map(|v| v as i32),
            felt_color: request.felt_color,
        };

        let updated = self.repo.update_pro_settings(club_id, settings.clone()).await?;

        if let Some(ref broker) = self.broker {
            let _ = broker.broadcast_club_theme_updated(club_id, settings).await;
        }

        Ok(updated)
    }

    async fn find_club_owner(&self, club_id: ClubId) -> Result<UserId, ClubError> {
        self.repo.find_club_owner(club_id).await
    }

    async fn is_club_pro_active(&self, user_id: UserId) -> Result<bool, ClubError> {
        self.user_repo.is_club_pro_active(user_id).await
            .map_err(|e| ClubError::Internal(e.to_string()))
    }
}

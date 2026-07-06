use sb_contracts::{ClubError, ClubRepo, ClubService, LeaderboardPage};
use sb_shared_types::{ClubId, RequestContext, UserId};
use std::sync::Arc;
use sb_contracts::service_api::{ClubProSettings, UpdateClubSettingsRequest};

pub struct ClubServiceImpl {
    repo: Arc<dyn ClubRepo>,
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
    async fn update_pro_settings(
        &self,
        _ctx: &RequestContext,
        club_id: ClubId,
        settings: UpdateClubSettingsRequest,
    ) -> Result<ClubProSettings, ClubError> {
        let existing = self.repo.get_club_pro_settings(club_id).await
            .map_err(|e| ClubError::Internal(e.to_string()))?
            .and_then(|v| serde_json::from_value::<ClubProSettings>(v).ok())
            .unwrap_or(ClubProSettings {
                banner_url: None,
                chip_preset_id: None,
                felt_color: None,
            });
        
        let merged = ClubProSettings {
            banner_url: settings.banner_url.or(existing.banner_url),
            chip_preset_id: settings.chip_preset_id.or(existing.chip_preset_id),
            felt_color: settings.felt_color.or(existing.felt_color),
        };
        
        let json = serde_json::to_value(&merged).map_err(|e| ClubError::Internal(e.to_string()))?;
        self.repo.update_club_pro_settings(club_id, json).await
            .map_err(|e| ClubError::Internal(e.to_string()))?;
        
        Ok(merged)
    }
    
    async fn get_pro_settings(
        &self,
        club_id: ClubId,
    ) -> Result<Option<ClubProSettings>, ClubError> {
        let settings = self.repo.get_club_pro_settings(club_id).await
            .map_err(|e| ClubError::Internal(e.to_string()))?;
        
        match settings {
            Some(v) => serde_json::from_value(v).map_err(|e| ClubError::Internal(e.to_string())),
            None => Ok(None),
        }
    }
    
    async fn find_club_owner(&self, club_id: ClubId) -> Result<Option<UserId>, ClubError> {
        let club = self.repo.find_club_by_id(club_id).await?;
        Ok(club.map(|c| c.created_by))
    }

    async fn is_club_pro_active(
        &self,
        _user_id: UserId,
    ) -> Result<bool, ClubError> {
        Ok(true)
    }
}
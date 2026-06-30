use sb_contracts::{
    ClubError, ClubRepo, ClubService, LeaderboardPage,
    service_api::{ClubProSettings, UpdateClubSettingsRequest},
};
use sb_shared_types::{AppError, ClubId, RequestContext, UserId};
use std::sync::Arc;
use chrono::Utc;

pub struct ClubServiceImpl {
    repo: Arc<dyn ClubRepo>,
    user_repo: Arc<dyn sb_contracts::repo_api::UserRepo>,
}

impl ClubServiceImpl {
    pub fn new(
        repo: Arc<dyn ClubRepo>,
        user_repo: Arc<dyn sb_contracts::repo_api::UserRepo>,
    ) -> Self {
        Self { repo, user_repo }
    }

    const VALID_CHIP_PRESETS: [i32; 5] = [1, 2, 3, 4, 5];
    const VALID_FELT_COLORS: [&str; 8] = [
        "#1a6b42", "#2d7a5a", "#3d8b69", "#4a9c78",
        "#1a4b6b", "#2d5a7a", "#6b1a42", "#7a2d5a",
    ];
}

#[async_trait::async_trait]
impl ClubService for ClubServiceImpl {
    async fn update_pro_settings(
        &self,
        ctx: RequestContext,
        club_id: ClubId,
        settings: UpdateClubSettingsRequest,
    ) -> Result<ClubProSettings, AppError> {
        let club = self.repo.find_by_id(club_id).await.map_err(|e| AppError::Internal(e.to_string()))?;
        if club.owner_id != ctx.user_id {
            return Err(AppError::Unauthorized("Only club owner can modify settings".to_string()));
        }

        let user = self.user_repo.find_by_id(ctx.user_id).await.map_err(|e| AppError::Internal(e.to_string()))?;
        let is_pro = user.club_pro_expires_at.map(|dt| dt > Utc::now()).unwrap_or(false);
        if !is_pro {
            return Err(AppError::Unauthorized("Club Pro subscription required".to_string()));
        }

        if let Some(preset_id) = settings.chip_preset_id {
            if !Self::VALID_CHIP_PRESETS.contains(&preset_id) {
                return Err(AppError::InvalidInput(format!("chip_preset_id must be 1-5, got {}", preset_id)));
            }
        }

        if let Some(ref color) = settings.felt_color {
            if !Self::VALID_FELT_COLORS.contains(&color.as_str()) {
                return Err(AppError::InvalidInput(format!("Invalid felt_color: {}", color)));
            }
        }

        if let Some(ref url) = settings.banner_url {
            if !url.starts_with("https://") {
                return Err(AppError::InvalidInput("banner_url must be HTTPS".to_string()));
            }
        }

        let existing = self.repo.get_club_pro_settings(club_id).await
            .map_err(|e| AppError::Internal(e.to_string()))?
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

        let json = serde_json::to_value(&merged).map_err(|e| AppError::Internal(e.to_string()))?;
        self.repo.update_club_pro_settings(club_id, json).await
            .map_err(|e| AppError::Internal(e.to_string()))?;

        Ok(merged)
    }

    async fn get_pro_settings(
        &self,
        club_id: ClubId,
    ) -> Result<Option<ClubProSettings>, AppError> {
        let settings = self.repo.get_club_pro_settings(club_id).await
            .map_err(|e| AppError::Internal(e.to_string()))?;

        match settings {
            Some(v) => serde_json::from_value(v).map_err(|e| AppError::Internal(e.to_string())),
            None => Ok(None),
        }
    }

    async fn is_club_pro_active(
        &self,
        user_id: UserId,
    ) -> Result<bool, AppError> {
        let user = self.user_repo.find_by_id(user_id).await
            .map_err(|e| AppError::Internal(e.to_string()))?;
        Ok(user.club_pro_expires_at.map(|dt| dt > Utc::now()).unwrap_or(false))
    }
}

use async_trait::async_trait;
use chrono::{DateTime, Utc};
use sb_shared_types::RequestContext;
use sb_shared_types::{AppError, ChipAmount, HandRank, TableId, UserId};
use serde::{Deserialize, Serialize};

use crate::repo_api::UserProfile;
use crate::{ClubError, LeaderboardPage};
use sb_shared_types::game_types::GameVariant;
use sb_shared_types::{ClubId, StakeLevel};

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct ClubProSettings {
    pub banner_url: Option<String>,
    pub chip_preset_id: Option<i32>,
    pub felt_color: Option<String>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct UpdateClubSettingsRequest {
    pub banner_url: Option<String>,
    pub chip_preset_id: Option<i32>,
    pub felt_color: Option<String>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct CreateClubRequest {
    pub name: String,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct CreateClubResponse {
    pub id: ClubId,
}

#[async_trait]
pub trait ClubService: Send + Sync {
    async fn create_club(
        &self,
        ctx: RequestContext,
        req: CreateClubRequest,
    ) -> Result<CreateClubResponse, AppError>;

    async fn get_leaderboard(
        &self,
        club_id: ClubId,
        page: u64,
    ) -> Result<LeaderboardPage, AppError>;

    async fn update_pro_settings(
        &self,
        ctx: RequestContext,
        club_id: ClubId,
        settings: UpdateClubSettingsRequest,
    ) -> Result<ClubProSettings, AppError>;

    async fn get_pro_settings(
        &self,
        club_id: ClubId,
    ) -> Result<Option<ClubProSettings>, AppError>;

    async fn is_club_pro_active(
        &self,
        user_id: UserId,
    ) -> Result<bool, AppError>;
}

pub use crate::leaderboard::LeaderboardPage;

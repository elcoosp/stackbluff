use crate::service_api::ReferralStats;
use async_trait::async_trait;
use chrono::{DateTime, Utc};
use sb_shared_types::TableId;
use sb_shared_types::{AppError, UserId};
use sb_shared_types::{ClubId, RequestContext};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

pub use crate::club_error::ClubError;
pub use crate::persistence_error::{PersistenceError, PersistenceResult};

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct UserProfile {
    pub id: UserId,
    pub username: String,
    pub club_pro_expires_at: Option<DateTime<Utc>>,
}

#[async_trait]
pub trait UserRepo: Send + Sync {
    async fn find_by_id(&self, id: UserId) -> PersistenceResult<UserProfile>;
}

#[async_trait]
pub trait ClubRepo: Send + Sync {
    async fn find_by_id(&self, club_id: ClubId) -> PersistenceResult<Club>;

    async fn create_club(&self, owner_id: UserId, name: String) -> PersistenceResult<Club>;

    async fn get_leaderboard(
        &self,
        club_id: ClubId,
        page: u64,
    ) -> PersistenceResult<LeaderboardPage>;

    async fn update_club_pro_settings(
        &self,
        club_id: ClubId,
        settings: serde_json::Value,
    ) -> PersistenceResult<()>;

    async fn get_club_pro_settings(
        &self,
        club_id: ClubId,
    ) -> PersistenceResult<Option<serde_json::Value>>;

    async fn get_tables_by_club_id(
        &self,
        club_id: ClubId,
    ) -> PersistenceResult<Vec<TableId>>;
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct Club {
    pub id: ClubId,
    pub name: String,
    pub owner_id: UserId,
}

pub const DIVISION_SIZE: u64 = 100;

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct LeaderboardEntry {
    pub user_id: UserId,
    pub score: i64,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct LeaderboardPage {
    pub entries: Vec<LeaderboardEntry>,
    pub total: u64,
}

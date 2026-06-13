use crate::PersistenceError;
use async_trait::async_trait;
use sb_shared_types::{AppError, RequestContext, TableId, UserId};

#[derive(Debug, serde::Serialize, serde::Deserialize)]
pub struct AuthResult {
    pub jwt: String,
    pub user_id: uuid::Uuid,
}

#[derive(Debug, serde::Serialize, serde::Deserialize)]
pub struct TokenClaims {
    pub user_id: uuid::Uuid,
    pub platform: String,
}
#[async_trait]
pub trait TableService: Send + Sync {
    async fn join_table(
        &self,
        user_id: UserId,
        table_id: TableId,
        ctx: &RequestContext,
    ) -> Result<(), AppError>;
    async fn leave_table(
        &self,
        user_id: UserId,
        table_id: TableId,
        ctx: &RequestContext,
    ) -> Result<(), AppError>;
}

#[async_trait]
pub trait AuthService: Send + Sync {
    async fn authenticate(&self, token: &str, ctx: &RequestContext) -> Result<UserId, AppError>;
    async fn telegram_auth(
        &self,
        ctx: &RequestContext,
        init_data: &str,
    ) -> Result<AuthResult, AppError>;
    async fn register(
        &self,
        ctx: &RequestContext,
        email: &str,
        password: &str,
    ) -> Result<AuthResult, AppError>;
    async fn login(
        &self,
        ctx: &RequestContext,
        email: &str,
        password: &str,
    ) -> Result<AuthResult, AppError>;
    async fn verify_token(&self, token: &str) -> Result<TokenClaims, AppError>;
}

#[async_trait]
pub trait PaymentService: Send + Sync {
    async fn deposit(
        &self,
        user_id: UserId,
        amount: u64,
        ctx: &RequestContext,
    ) -> Result<(), AppError>;
}

#[async_trait]
pub trait ViralService: Send + Sync {
    async fn share_referral(
        &self,
        user_id: UserId,
        code: &str,
        ctx: &RequestContext,
    ) -> Result<(), AppError>;
}

#[async_trait]
pub trait MissionService: Send + Sync {
    async fn check_missions(
        &self,
        user_id: UserId,
        ctx: &RequestContext,
    ) -> Result<Vec<String>, AppError>;
}

#[async_trait]
pub trait AntiCheatService: Send + Sync {
    async fn report_anomaly(
        &self,
        user_id: UserId,
        details: &str,
        ctx: &RequestContext,
    ) -> Result<(), AppError>;
}

#[async_trait]
pub trait OracleService {
    type Params;
    type Output;
    type Error;

    async fn analyze(
        &self,
        ctx: &RequestContext,
        params: Self::Params,
    ) -> Result<Self::Output, Self::Error>;
}

#[async_trait]
pub trait NotificationService: Send + Sync {
    async fn send_telegram_message(&self, chat_id: i64, text: String, keyboard: Option<serde_json::Value>) -> Result<(), PersistenceError>;
    async fn send_telegram_message_to_user(&self, user_id: UserId, text: String, keyboard: Option<serde_json::Value>) -> Result<(), PersistenceError>;
    async fn answer_callback_query(&self, callback_query_id: String, text: Option<String>) -> Result<(), PersistenceError>;
}

/// Service interface for club operations.
#[async_trait::async_trait]
pub trait ClubService: Send + Sync {
    async fn create_club(
        &self,
        name: &str,
        logo_url: Option<&str>,
        created_by: sb_shared_types::UserId,
    ) -> Result<sb_shared_types::ClubId, crate::persistence_error::PersistenceError>;

    async fn join_club(
        &self,
        club_id: sb_shared_types::ClubId,
        user_id: sb_shared_types::UserId,
    ) -> Result<(), crate::persistence_error::PersistenceError>;

    async fn get_leaderboard(
        &self,
        club_id: sb_shared_types::ClubId,
        division: u32,
    ) -> Result<crate::repo_api::LeaderboardPage, crate::persistence_error::PersistenceError>;

    /// Called when a club member earns XP (e.g. plays a hand at a club table).
    async fn add_xp(
        &self,
        club_id: sb_shared_types::ClubId,
        user_id: sb_shared_types::UserId,
        xp: i64,
    ) -> Result<(), crate::persistence_error::PersistenceError>;
}

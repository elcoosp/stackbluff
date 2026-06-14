use crate::repo_api::ClubResult;
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

#[async_trait::async_trait]
pub trait TableService: Send + Sync {
    async fn create_table(
        &self,
        ctx: &RequestContext,
        input: CreateTableInput,
    ) -> Result<TableId, AppError>;

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

#[async_trait::async_trait]
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

#[async_trait::async_trait]
pub trait PaymentService: Send + Sync {
    async fn deposit(
        &self,
        user_id: UserId,
        amount: u64,
        ctx: &RequestContext,
    ) -> Result<(), AppError>;
}

#[async_trait::async_trait]
pub trait ViralService: Send + Sync {
    async fn share_referral(
        &self,
        user_id: UserId,
        code: &str,
        ctx: &RequestContext,
    ) -> Result<(), AppError>;
}

#[async_trait::async_trait]
pub trait MissionService: Send + Sync {
    async fn check_missions(
        &self,
        user_id: UserId,
        ctx: &RequestContext,
    ) -> Result<Vec<String>, AppError>;
}

#[async_trait::async_trait]
pub trait OracleService: Send + Sync {
    type Params: Send;
    type Output: Send;
    type Error: std::error::Error + Send;

    async fn analyze(
        &self,
        ctx: &RequestContext,
        params: Self::Params,
    ) -> Result<Self::Output, Self::Error>;

    async fn answer_callback_query(
        &self,
        callback_query_id: String,
        text: Option<String>,
    ) -> Result<(), Self::Error>;
}

/// Input for creating a table.
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct CreateTableInput {
    pub name: String,
    pub club_id: Option<sb_shared_types::ClubId>,
    pub stake_level: sb_shared_types::game_types::StakeLevel,
    pub variant: sb_shared_types::game_types::GameVariant,
    pub created_by: UserId,
    pub is_private: bool,
    pub invited_users: Vec<UserId>,
}

/// Service interface for club operations.
///
/// All methods accept `RequestContext` for request tracing.
#[async_trait::async_trait]
pub trait ClubService: Send + Sync {
    async fn create_club(
        &self,
        ctx: &RequestContext,
        name: &str,
        logo_url: Option<&str>,
        created_by: UserId,
    ) -> ClubResult<sb_shared_types::ClubId>;

    async fn join_club(
        &self,
        ctx: &RequestContext,
        club_id: sb_shared_types::ClubId,
        user_id: UserId,
    ) -> ClubResult<()>;

    async fn get_leaderboard(
        &self,
        ctx: &RequestContext,
        club_id: sb_shared_types::ClubId,
        division: u32,
    ) -> ClubResult<crate::repo_api::LeaderboardPage>;

    /// Called when a club member earns XP (e.g. plays a hand at a club table).
    async fn add_xp(
        &self,
        ctx: &RequestContext,
        club_id: sb_shared_types::ClubId,
        user_id: UserId,
        xp: i64,
    ) -> ClubResult<()>;
}

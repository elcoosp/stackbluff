use async_trait::async_trait;
use sb_shared_types::errors::AppError;
use sb_shared_types::request_context::RequestContext;
use uuid::Uuid;

#[derive(Debug, Clone)]
pub struct UserInfo {
    pub id: Uuid,
    pub telegram_id: Option<i64>,
    pub email: Option<String>,
    pub password_hash: String,
}

#[async_trait]
pub trait UserRepo: Send + Sync {
    async fn find_or_create_by_telegram(
        &self,
        ctx: &RequestContext,
        tg_id: i64,
    ) -> Result<UserInfo, AppError>;

    async fn create_email_user(
        &self,
        ctx: &RequestContext,
        email: &str,
        password_hash: &str,
    ) -> Result<UserInfo, AppError>;

    async fn find_by_email(
        &self,
        ctx: &RequestContext,
        email: &str,
    ) -> Result<Option<UserInfo>, AppError>;
}

use async_trait::async_trait;
use sb_contracts::repo_api::UserRepo;
use sb_contracts::user_resolution::{UserResolutionError, UserResolutionService};
use sb_shared_types::{RequestContext, UserId};
use std::sync::Arc;
use uuid::Uuid;

pub struct UserResolutionServiceImpl {
    user_repo: Arc<dyn UserRepo>,
}

impl UserResolutionServiceImpl {
    pub fn new(user_repo: Arc<dyn UserRepo>) -> Self {
        Self { user_repo }
    }
}

#[async_trait]
impl UserResolutionService for UserResolutionServiceImpl {
    async fn resolve_telegram_user(
        &self,
        telegram_id: &str,
    ) -> Result<UserId, UserResolutionError> {
        let tg_id: i64 = telegram_id
            .parse()
            .map_err(|_| UserResolutionError::Internal("Invalid telegram ID".to_string()))?;
        let ctx = RequestContext::new(Uuid::new_v4(), None);
        let user_id = self
            .user_repo
            .find_by_telegram(ctx, tg_id)
            .await
            .map_err(|e| UserResolutionError::Internal(e.to_string()))?;
        user_id.ok_or(UserResolutionError::TelegramNotLinked)
    }
}

use async_trait::async_trait;
use sb_contracts::repo_api::{UserProfile, UserRepo};
use sb_contracts::service_api::UserService;
use sb_shared_types::{AppError, ChipAmount, RequestContext, UserId};
use std::sync::Arc;
use uuid::Uuid;

pub struct UserServiceImpl {
    user_repo: Arc<dyn UserRepo>,
}

impl UserServiceImpl {
    pub fn new(user_repo: Arc<dyn UserRepo>) -> Self {
        Self { user_repo }
    }
}

#[async_trait]
impl UserService for UserServiceImpl {
    async fn award_chips(&self, user_id: UserId, amount: ChipAmount) -> Result<(), AppError> {
        let ctx = RequestContext::new(Uuid::new_v4(), Some(user_id));
        self.user_repo
            .update_chip_balance(ctx, user_id, amount.as_i64())
            .await
            .map_err(|e| AppError::Database(e.to_string()))?;
        Ok(())
    }

    async fn get_user_name(&self, user_id: UserId) -> Result<String, AppError> {
        let ctx = RequestContext::new(Uuid::new_v4(), Some(user_id));
        let profile = self
            .user_repo
            .get_user_profile(ctx, user_id)
            .await
            .map_err(|e| AppError::Database(e.to_string()))?;
        Ok(profile.display_name)
    }

    async fn get_registration_order(&self, user_id: UserId) -> Result<Option<u64>, AppError> {
        let ctx = RequestContext::new(Uuid::new_v4(), Some(user_id));
        let profile = self
            .user_repo
            .get_user_profile(ctx, user_id)
            .await
            .map_err(|e| AppError::Database(e.to_string()))?;
        Ok(profile.registration_order)
    }

    async fn is_email_verified(&self, user_id: UserId) -> Result<bool, AppError> {
        let ctx = RequestContext::new(Uuid::new_v4(), Some(user_id));
        let profile = self
            .user_repo
            .get_user_profile(ctx, user_id)
            .await
            .map_err(|e| AppError::Database(e.to_string()))?;
        Ok(profile.email_verified_at.is_some())
    }

    async fn get_user_profile(&self, user_id: UserId) -> Result<UserProfile, AppError> {
        let ctx = RequestContext::new(Uuid::new_v4(), Some(user_id));
        let profile = self
            .user_repo
            .get_user_profile(ctx, user_id)
            .await
            .map_err(|e| AppError::Database(e.to_string()))?;
        Ok(profile)
    }
}

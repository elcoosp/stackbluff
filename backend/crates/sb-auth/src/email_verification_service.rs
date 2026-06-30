use std::sync::Arc;
use uuid::Uuid;

use crate::config::AuthConfig;
use crate::email_queue::EmailQueue;
use crate::jwt::{create_verification_token, verify_verification_token};
use crate::rate_limiter::RateLimiter;
use sb_contracts::repo_api::UserRepo;
use sb_shared_types::{AppError, RequestContext, UserId};

/// Service responsible for email verification flows
pub struct EmailVerificationService {
    user_repo: Arc<dyn UserRepo>,
    config: Arc<AuthConfig>,
    email_queue: Arc<EmailQueue>,
    rate_limiter: Arc<RateLimiter>,
}

impl EmailVerificationService {
    pub fn new(
        user_repo: Arc<dyn UserRepo>,
        config: Arc<AuthConfig>,
        email_queue: Arc<EmailQueue>,
        rate_limiter: Arc<RateLimiter>,
    ) -> Self {
        Self {
            user_repo,
            config,
            email_queue,
            rate_limiter,
        }
    }

    /// Send verification email to user
    pub async fn send_verification_email(
        &self,
        ctx: &RequestContext,
        user_id: UserId,
    ) -> Result<(), AppError> {
        let profile = self
            .user_repo
            .get_user_profile(ctx.clone(), user_id)
            .await
            .map_err(|e| AppError::Database(e.to_string()))?;

        if profile.email.is_none() {
            return Err(AppError::InvalidInput(
                "User does not have an email address".into(),
            ));
        }

        let email = profile.email.as_ref().ok_or_else(|| AppError::InvalidInput("User does not have an email address".into()))?;

        if !self.rate_limiter.check_and_record(email) {
            return Err(AppError::TooManyRequests(
                "Rate limit exceeded. Please try again later.".into(),
            ));
        }

        let token = create_verification_token(
            user_id.0,
            email,
            self.config.jwt_secret_str(),
            self.config.verification_token_ttl_seconds,
        )
        .map_err(|e| AppError::Internal(format!("JWT error: {}", e)))?;

        self.email_queue.queue_verification_email(email.clone(), token);
        tracing::info!(user_id = %user_id, "Verification email queued");
        Ok(())
    }

    /// Verify user's email using token
    pub async fn verify_email(&self, token: &str) -> Result<(), AppError> {
        let claims = verify_verification_token(token, self.config.jwt_secret_str())
            .map_err(|e| AppError::Unauthorized(format!("Invalid verification token: {}", e)))?;

        if claims.purpose != "email_verify" {
            return Err(AppError::Unauthorized(
                "Token is not for email verification".into(),
            ));
        }

        let user_id = UserId(claims.sub);
        let ctx = RequestContext::new(Uuid::new_v4(), None);

        // Check if already verified (idempotency)
        let profile = self
            .user_repo
            .get_user_profile(ctx.clone(), user_id)
            .await
            .map_err(|e| AppError::Database(e.to_string()))?;

        if profile.email_verified_at.is_some() {
            tracing::info!(user_id = %user_id, "Email already verified");
            return Ok(());
        }

        self.user_repo
            .mark_email_verified(ctx, user_id)
            .await
            .map_err(|e| AppError::Database(e.to_string()))?;

        tracing::info!(user_id = %user_id, "Email verified successfully");
        Ok(())
    }
}

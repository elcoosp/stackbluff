use std::sync::Arc;
use uuid::Uuid;
use argon2::PasswordHasher;

use crate::config::AuthConfig;
use crate::email_queue::EmailQueue;
use crate::jwt::{create_reset_token, verify_verification_token};
use crate::rate_limiter::RateLimiter;
use sb_contracts::repo_api::UserRepo;
use sb_shared_types::{AppError, RequestContext, UserId};

/// Service responsible for password reset flows
pub struct PasswordResetService {
    user_repo: Arc<dyn UserRepo>,
    config: Arc<AuthConfig>,
    email_queue: Arc<EmailQueue>,
    rate_limiter: Arc<RateLimiter>,
}

impl PasswordResetService {
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

    /// Initiate password reset by sending email
    pub async fn forgot_password(
        &self,
        ctx: &RequestContext,
        email: &str,
    ) -> Result<(), AppError> {
        let user_id = self
            .user_repo
            .find_by_email(ctx.clone(), email)
            .await
            .map_err(|e| AppError::Database(e.to_string()))?;

        // Silently succeed if user not found (don't leak user existence)
        let user_id = match user_id {
            Some(id) => id,
            None => {
                tracing::info!(email = %email, "Password reset requested for unknown email");
                return Ok(());
            }
        };

        if !self.rate_limiter.check_and_record(email) {
            return Err(AppError::TooManyRequests(
                "Rate limit exceeded. Please try again later.".into(),
            ));
        }

        let token = create_reset_token(
            user_id.0,
            email,
            self.config.jwt_secret_str(),
            self.config.reset_token_ttl_seconds,
        )
        .map_err(|e| AppError::Internal(format!("JWT error: {}", e)))?;

        self.email_queue.queue_password_reset_email(email.to_string(), token);
        tracing::info!(user_id = %user_id, "Password reset email queued");
        Ok(())
    }

    /// Complete password reset with new password
    pub async fn reset_password(
        &self,
        token: &str,
        new_password: &str,
    ) -> Result<(), AppError> {
        if new_password.len() < 8 {
            return Err(AppError::InvalidInput("Password too short".into()));
        }

        let claims = verify_verification_token(token, self.config.jwt_secret_str())
            .map_err(|e| AppError::Unauthorized(format!("Invalid reset token: {}", e)))?;

        if claims.purpose != "reset_password" {
            return Err(AppError::Unauthorized(
                "Token is not for password reset".into(),
            ));
        }

        let hash = crate::config::argon2_instance()
            .hash_password(new_password.as_bytes())
            .map_err(|e| AppError::Internal(format!("Failed to hash password: {}", e)))?
            .to_string();

        let user_id = UserId(claims.sub);
        let ctx = RequestContext::new(Uuid::new_v4(), None);

        self.user_repo
            .update_password_with_timestamp(ctx, user_id, &hash)
            .await
            .map_err(|e| AppError::Database(e.to_string()))?;

        tracing::info!(user_id = %user_id, "Password reset successfully");
        Ok(())
    }
}

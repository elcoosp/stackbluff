use async_trait::async_trait;
use hmac::{Hmac, KeyInit, Mac};
use sha2::Sha256;
use std::sync::Arc;
use std::time::Duration;
use chrono::Utc;
use url::form_urlencoded;
use uuid::Uuid;

use argon2::PasswordHasher;

use crate::config::AuthConfig;
use crate::email_queue::EmailQueue;
use crate::jwt::{
    create_jwt, verify_jwt, verify_verification_token};
use crate::rate_limiter::RateLimiter;
use sb_contracts::repo_api::{PersistenceError, UserProfile, UserRepo};
use sb_contracts::service_api::{AuthResult, AuthService, TokenClaims};
use sb_shared_types::{AppError, RequestContext, UserId};

type HmacSha256 = Hmac<Sha256>;

/// Rate limit: max 3 email sends per hour per email address
const EMAIL_RATE_LIMIT_MAX: usize = 3;
const EMAIL_RATE_LIMIT_WINDOW_SECS: u64 = 3600;

pub struct AuthServiceImpl {
    user_repo: std::sync::Arc<dyn UserRepo>,
    config: Arc<AuthConfig>,
    email_queue: Option<Arc<EmailQueue>>,
    rate_limiter: Arc<RateLimiter>,
    login_rate_limiter: Arc<crate::login_rate_limiter::LoginRateLimiter>,
    email_verification_service: Option<Arc<crate::email_verification_service::EmailVerificationService>>,
    password_reset_service: Option<Arc<crate::password_reset_service::PasswordResetService>>,
}


impl AuthServiceImpl {
    /// Spawn background task to clean up rate limiter entries
    pub fn spawn_rate_limiter_cleanup(self: &Arc<Self>, interval_secs: u64) {
        let limiter = self.rate_limiter.clone();
        tokio::spawn(async move {
            limiter.spawn_cleanup(interval_secs).await.ok();
        });
    }

    pub fn new(user_repo: std::sync::Arc<dyn UserRepo>, config: AuthConfig) -> Self {
        Self {
            user_repo,
            config: Arc::new(config),
            email_queue: None,
            login_rate_limiter: Arc::new(crate::login_rate_limiter::LoginRateLimiter::new(
                5,
                std::time::Duration::from_secs(900),
                std::time::Duration::from_secs(3600),
            )),
            email_verification_service: None,
            password_reset_service: None,
            rate_limiter: Arc::new(RateLimiter::new(
                EMAIL_RATE_LIMIT_MAX,
                Duration::from_secs(EMAIL_RATE_LIMIT_WINDOW_SECS),
            )),
        }
    }

    /// Builder method to add email support after construction.
    pub fn with_email_support(mut self, email_queue: Arc<EmailQueue>) -> Self {
        self.email_queue = Some(email_queue.clone());

        // Initialize the focused services
        self.email_verification_service = Some(Arc::new(
            crate::email_verification_service::EmailVerificationService::new(
                self.user_repo.clone(),
                self.config.clone(),
                email_queue.clone(),
                self.rate_limiter.clone(),
            )
        ));

        self.password_reset_service = Some(Arc::new(
            crate::password_reset_service::PasswordResetService::new(
                self.user_repo.clone(),
                self.config.clone(),
                email_queue,
                self.rate_limiter.clone(),
            )
        ));

        self
    }

    fn validate_telegram_init_data(&self, init_data: &str) -> Result<serde_json::Value, AppError> {
        let parsed: Vec<(String, String)> = form_urlencoded::parse(init_data.as_bytes())
            .into_owned()
            .collect();

        let mut hash = None;
        let mut params = Vec::new();
        for (key, val) in parsed {
            if key == "hash" {
                hash = Some(val);
            } else {
                params.push((key, val));
            }
        }

        let hash = hash.ok_or_else(|| AppError::InvalidInput("Missing hash".into()))?;

        params.sort_by(|a, b| a.0.cmp(&b.0));
        let data_check_string = params
            .iter()
            .map(|(k, v)| format!("{}={}", k, v))
            .collect::<Vec<_>>()
            .join("\n");

        let mut secret_key = HmacSha256::new_from_slice(self.config.bot_token_str().as_bytes())
            .map_err(|e| AppError::Internal(format!("HMAC error: {}", e)))?;
        secret_key.update(b"WebAppData");
        let secret_key = secret_key.finalize().into_bytes();

        let mut mac = HmacSha256::new_from_slice(&secret_key)
            .map_err(|e| AppError::Internal(format!("HMAC error: {}", e)))?;
        mac.update(data_check_string.as_bytes());
        let computed = hex::encode(mac.finalize().into_bytes());

        if computed != hash {
            return Err(AppError::Unauthorized("Invalid initData".into()));
        }

        let user_field = params.iter().find(|(k, _)| k == "user");
        let user_json: serde_json::Value = if let Some((_, v)) = user_field {
            serde_json::from_str(v)
                .map_err(|e| AppError::InvalidInput(format!("Invalid user JSON: {}", e)))?
        } else {
            return Err(AppError::InvalidInput("Missing user field".into()));
        };

        Ok(user_json)
    }
}

#[async_trait]
impl AuthService for AuthServiceImpl {
    async fn authenticate(&self, token: &str, _ctx: &RequestContext) -> Result<UserId, AppError> {
        let claims = self.verify_token(token).await?;
        Ok(claims.user_id)
    }

    async fn telegram_auth(
        &self,
        ctx: &RequestContext,
        init_data: &str,
    ) -> Result<AuthResult, AppError> {
        let user_json = self.validate_telegram_init_data(init_data)?;
        let tg_id = user_json
            .get("id")
            .and_then(|v| v.as_i64())
            .ok_or_else(|| AppError::InvalidInput("Missing telegram id".into()))?;

        let user_id = self
            .user_repo
            .find_or_create_by_telegram(ctx.clone(), tg_id)
            .await
            .map_err(map_persistence_error)?;

        let token = create_jwt(
            user_id.0,
            "telegram",
            self.config.jwt_secret_str(),
            self.config.jwt_expiry_days,
            None, // Telegram users don't have passwords
        )
        .map_err(|e| AppError::Internal(format!("JWT error: {}", e)))?;

        tracing::info!(user_id = %user_id, "Telegram auth success");
        Ok(AuthResult {
            jwt: token,
            user_id,
        })
    }

    async fn register(
        &self,
        ctx: &RequestContext,
        username: &str,
        email: &str,
        password: &str,
    ) -> Result<AuthResult, AppError> {
        if username.is_empty() {
            return Err(AppError::InvalidInput("Username is required".into()));
        }
        if email.is_empty() || !email.contains('@') {
            return Err(AppError::InvalidInput("Invalid email".into()));
        }
        if password.len() < 8 {
            return Err(AppError::InvalidInput("Password too short".into()));
        }

        let hash = crate::config::argon2_instance()
            .hash_password(password.as_bytes())
            .map_err(|e| AppError::Internal(format!("Failed to hash password: {}", e)))?
            .to_string();

        let user_id = self
            .user_repo
            .create_email_user(ctx.clone(), username, email, &hash)
            .await
            .map_err(map_persistence_error)?;

        // Queue verification email through the service (fire-and-forget)
        if let Some(service) = &self.email_verification_service {
            let service_clone = service.clone();
            let ctx_clone = ctx.clone();
            let user_id_clone = user_id;
            tokio::spawn(async move {
                if let Err(e) = service_clone.send_verification_email(&ctx_clone, user_id_clone).await {
                    tracing::warn!(error = %e, "Failed to send verification email during registration");
                }
            });
        }

        let token = create_jwt(
            user_id.0,
            "pwa",
            self.config.jwt_secret_str(),
            self.config.jwt_expiry_days,
            Some(Utc::now().timestamp() as usize), // New registration, password just set
        )
        .map_err(|e| AppError::Internal(format!("JWT error: {}", e)))?;

        tracing::info!(user_id = %user_id, "Email registration success");
        Ok(AuthResult {
            jwt: token,
            user_id,
        })
    }

    async fn login(
        &self,
        ctx: &RequestContext,
        email: &str,
        password: &str,
    ) -> Result<AuthResult, AppError> {
        use argon2::PasswordVerifier;

        // Check if account is locked
        if self.login_rate_limiter.is_locked(email) {
            return Err(AppError::TooManyRequests(
                "Account temporarily locked due to too many failed login attempts. Please try again later.".into(),
            ));
        }

        // Get user with password hash
        let user_with_hash = self
            .user_repo
            .find_by_email_with_hash(ctx.clone(), email)
            .await
            .map_err(map_persistence_error)?;

        // If user not found, still do password check to prevent timing attacks
        let user_with_hash = match user_with_hash {
            Some(u) => u,
            None => {
                // Perform dummy hash check to maintain consistent timing
                let dummy_hash = "$argon2id$v=19$m=19456,t=2,p=1$dummy$dummy";
                if let Ok(h) = argon2::PasswordHash::new(dummy_hash) {
                    let _ = crate::config::argon2_instance().verify_password(password.as_bytes(), &h);
                }

                self.login_rate_limiter.record_failure(email);
                return Err(AppError::Unauthorized("Invalid email or password".into()));
            }
        };

        // Verify password against stored hash
        let stored_hash = user_with_hash.password_hash.as_deref()
            .ok_or_else(|| AppError::Unauthorized("Invalid email or password".into()))?;

        let parsed_hash = argon2::PasswordHash::new(stored_hash)
            .map_err(|e| AppError::Internal(format!("Invalid password hash: {}", e)))?;

        if crate::config::argon2_instance()
            .verify_password(password.as_bytes(), &parsed_hash)
            .is_err()
        {
            let locked = self.login_rate_limiter.record_failure(email);
            if locked {
                return Err(AppError::TooManyRequests(
                    "Account temporarily locked due to too many failed login attempts. Please try again later.".into(),
                ));
            }
            return Err(AppError::Unauthorized("Invalid email or password".into()));
        }

        // Successful login - clear failure counter
        self.login_rate_limiter.record_success(email);

        // For PWA users, we could track password_changed_at in the DB
        // For now, use None (all existing tokens remain valid)
        // TODO: Add password_changed_at column to users table
        let token = create_jwt(
            user_with_hash.id.0,
            "pwa",
            self.config.jwt_secret_str(),
            self.config.jwt_expiry_days,
            None,
        )
        .map_err(|e| AppError::Internal(format!("JWT error: {}", e)))?;

        tracing::info!(user_id = %user_with_hash.id, "Email login success");
        Ok(AuthResult {
            jwt: token,
            user_id: user_with_hash.id,
        })
    }

    async fn validate_token(&self, token: &str) -> Result<UserId, AppError> {
        let claims = self.verify_token(token).await?;
        Ok(claims.user_id)
    }

    async fn verify_token(&self, token: &str) -> Result<TokenClaims, AppError> {
        let claims = verify_jwt(token, self.config.jwt_secret_str())
            .map_err(|e| AppError::Unauthorized(format!("Invalid token: {}", e)))?;
        Ok(TokenClaims {
            user_id: UserId(claims.sub),
            platform: claims.platform,
        })
    }

    async fn get_user_profile(
        &self,
        ctx: &RequestContext,
        user_id: UserId,
    ) -> Result<UserProfile, AppError> {
        self.user_repo
            .get_user_profile(ctx.clone(), user_id)
            .await
            .map_err(map_persistence_error)
    }

    async fn send_verification_email(
        &self,
        ctx: &RequestContext,
        user_id: UserId,
    ) -> Result<(), AppError> {
        let service = self.email_verification_service
            .as_ref()
            .ok_or_else(|| AppError::Configuration("Email service not configured".into()))?;
        service.send_verification_email(ctx, user_id).await
    }

    async fn verify_email(&self, token: &str) -> Result<(), AppError> {
        let claims = verify_verification_token(token, self.config.jwt_secret_str())
            .map_err(|e| AppError::Unauthorized(format!("Invalid verification token: {}", e)))?;

        if claims.purpose != "email_verify" {
            return Err(AppError::Unauthorized(
                "Token is not for email verification".into(),
            ));
        }

        let user_id = UserId(claims.sub);
        let ctx = RequestContext::new(Uuid::new_v4(), None);

        self.user_repo
            .mark_email_verified(ctx, user_id)
            .await
            .map_err(map_persistence_error)?;

        tracing::info!(user_id = %user_id, "Email verified successfully");
        Ok(())
    }

    async fn forgot_password(
        &self,
        ctx: &RequestContext,
        email: &str,
    ) -> Result<(), AppError> {
        let service = self.password_reset_service
            .as_ref()
            .ok_or_else(|| AppError::Configuration("Email service not configured".into()))?;
        service.forgot_password(ctx, email).await
    }

    async fn reset_password(
        &self,
        token: &str,
        new_password: &str,
    ) -> Result<(), AppError> {
        let service = self.password_reset_service
            .as_ref()
            .ok_or_else(|| AppError::Configuration("Email service not configured".into()))?;
        service.reset_password(token, new_password).await
    }
}

fn map_persistence_error(e: PersistenceError) -> AppError {
    match e {
        PersistenceError::UniqueViolation => {
            AppError::Conflict("Resource already exists".to_string())
        }
        PersistenceError::NotFound => AppError::NotFound("User not found".to_string()),
        _ => AppError::Internal(e.to_string()),
    }
}

#[async_trait]
pub trait Authenticator: Send + Sync {
    async fn authenticate(&self, token: &str) -> Result<UserId, AppError>;
    async fn validate_token(&self, token: &str) -> Result<UserId, AppError>;
}

#[async_trait]
impl Authenticator for AuthServiceImpl {
    async fn authenticate(&self, token: &str) -> Result<UserId, AppError> {
        let dummy_ctx = RequestContext::new(Uuid::new_v4(), None);
        <Self as AuthService>::authenticate(self, token, &dummy_ctx).await
    }

    async fn validate_token(&self, token: &str) -> Result<UserId, AppError> {
        let dummy_ctx = RequestContext::new(Uuid::new_v4(), None);
        <Self as AuthService>::authenticate(self, token, &dummy_ctx).await
    }
}

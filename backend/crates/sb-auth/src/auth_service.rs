use async_trait::async_trait;
use hmac::{Hmac, KeyInit, Mac};
use sha2::Sha256;
use url::form_urlencoded;
use uuid::Uuid;

use argon2::PasswordHasher;

use crate::config::AuthConfig;
use crate::jwt::{create_jwt, verify_jwt};
use sb_contracts::repo_api::{PersistenceError, UserProfile, UserRepo};
use sb_contracts::service_api::{AuthResult, AuthService, TokenClaims};
use sb_shared_types::{AppError, RequestContext, UserId};

type HmacSha256 = Hmac<Sha256>;

pub struct AuthServiceImpl {
    user_repo: std::sync::Arc<dyn UserRepo>,
    config: AuthConfig,
}

impl AuthServiceImpl {
    pub fn new(user_repo: std::sync::Arc<dyn UserRepo>, config: AuthConfig) -> Self {
        Self { user_repo, config }
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

        let token = create_jwt(
            user_id.0,
            "email",
            self.config.jwt_secret_str(),
            self.config.jwt_expiry_days,
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
        _password: &str,
    ) -> Result<AuthResult, AppError> {
        let user_id = self
            .user_repo
            .find_by_email(ctx.clone(), email)
            .await
            .map_err(map_persistence_error)?
            .ok_or_else(|| AppError::Unauthorized("Invalid email or password".into()))?;

        let token = create_jwt(
            user_id.0,
            "email",
            self.config.jwt_secret_str(),
            self.config.jwt_expiry_days,
        )
        .map_err(|e| AppError::Internal(format!("JWT error: {}", e)))?;

        tracing::info!(user_id = %user_id, "Email login success");
        Ok(AuthResult {
            jwt: token,
            user_id,
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

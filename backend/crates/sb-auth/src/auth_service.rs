
use std::sync::Arc;

use async_trait::async_trait;
use argon2::{PasswordHasher, PasswordVerifier};
use hmac::{Hmac, Mac};
use sha2::Sha256;
use uuid::Uuid;

use sb_contracts::repo_api::UserRepo;
use sb_contracts::service_api::{AuthResult, AuthService, TokenClaims};
use sb_shared_types::errors::AppError;
use sb_shared_types::ids::UserId;
use sb_shared_types::request_context::RequestContext;

use crate::config::{argon2_instance, AuthConfig};
use crate::jwt::{create_jwt, verify_jwt};

type HmacSha256 = Hmac<Sha256>;

pub struct AuthServiceImpl {
    user_repo: Arc<dyn UserRepo>,
    config: AuthConfig,
}

impl AuthServiceImpl {
    pub fn new(user_repo: Arc<dyn UserRepo>, config: AuthConfig) -> Self {
        Self { user_repo, config }
    }

    fn validate_telegram_init_data(&self, init_data: &str) -> Result<serde_json::Value, AppError> {
        let mut params: Vec<(&str, &str)> = Vec::new();
        let mut hash = None;
        for pair in init_data.split('&') {
            let mut kv = pair.splitn(2, '=');
            let key = kv.next().unwrap_or("");
            let val = kv.next().unwrap_or("");
            if key == "hash" {
                hash = Some(val);
            } else {
                params.push((key, val));
            }
        }

        let hash = hash.ok_or_else(|| AppError::InvalidInput("Missing hash in initData".into()))?;

        params.sort_by(|a, b| a.0.cmp(b.0));
        let data_check_string = params
            .iter()
            .map(|(k, v)| format!("{}={}", k, v))
            .collect::<Vec<_>>()
            .join("\n");

        let mut secret_key =
            HmacSha256::new_from_slice(self.config.bot_token.as_bytes())
                .map_err(|e| AppError::Internal(format!("HMAC error: {}", e)))?;
        secret_key.update(b"WebAppData");
        let secret_key = secret_key.finalize().into_bytes();

        let mut mac = HmacSha256::new_from_slice(&secret_key)
            .map_err(|e| AppError::Internal(format!("HMAC error: {}", e)))?;
        mac.update(data_check_string.as_bytes());
        let computed = hex::encode(mac.finalize().into_bytes());

        if computed != hash {
            return Err(AppError::Unauthorized("Invalid initData hash".into()));
        }

        let user_field = params.iter().find(|(k, _)| *k == "user");
        let user_json: serde_json::Value = if let Some((_, v)) = user_field {
            serde_json::from_str(v).map_err(|e| AppError::InvalidInput(format!("Invalid user JSON: {}", e)))?
        } else {
            return Err(AppError::InvalidInput("initData missing user field".into()));
        };

        Ok(user_json)
    }
}

#[async_trait]
impl AuthService for AuthServiceImpl {
    async fn authenticate(&self, token: &str, _ctx: &RequestContext) -> Result<UserId, AppError> {
        let claims = self.verify_token(token).await?;
        Ok(UserId(claims.user_id))
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
            .ok_or_else(|| AppError::InvalidInput("initData user missing id".into()))?;

        let user = self.user_repo.find_or_create_by_telegram(ctx, tg_id).await?;

        let token = create_jwt(
            user.id,
            "telegram",
            &self.config.jwt_secret,
            self.config.jwt_expiry_days,
        ).map_err(|e| AppError::Internal(format!("JWT creation error: {}", e)))?;

        Ok(AuthResult {
            jwt: token,
            user_id: user.id,
        })
    }

    async fn register(
        &self,
        ctx: &RequestContext,
        email: &str,
        password: &str,
    ) -> Result<AuthResult, AppError> {
        if email.is_empty() || password.is_empty() {
            return Err(AppError::InvalidInput("Email and password required".into()));
        }

        let password_hash = argon2_instance()
            .hash_password(password.as_bytes())
            .map_err(|e| AppError::Internal(format!("Password hash error: {}", e)))?
            .to_string();

        let user = self.user_repo.create_email_user(ctx, email, &password_hash).await?;

        let token = create_jwt(
            user.id,
            "email",
            &self.config.jwt_secret,
            self.config.jwt_expiry_days,
        ).map_err(|e| AppError::Internal(format!("JWT creation error: {}", e)))?;

        Ok(AuthResult {
            jwt: token,
            user_id: user.id,
        })
    }

    async fn login(
        &self,
        ctx: &RequestContext,
        email: &str,
        password: &str,
    ) -> Result<AuthResult, AppError> {
        let user = self.user_repo.find_by_email(ctx, email).await?;
        let user = user.ok_or_else(|| AppError::Unauthorized("Invalid email or password".into()))?;

        let parsed_hash = argon2::PasswordHash::new(&user.password_hash)
            .map_err(|e| AppError::Internal(format!("Invalid password hash format: {}", e)))?;
        argon2_instance()
            .verify_password(password.as_bytes(), &parsed_hash)
            .map_err(|_| AppError::Unauthorized("Invalid email or password".into()))?;

        let token = create_jwt(
            user.id,
            "email",
            &self.config.jwt_secret,
            self.config.jwt_expiry_days,
        ).map_err(|e| AppError::Internal(format!("JWT creation error: {}", e)))?;

        Ok(AuthResult {
            jwt: token,
            user_id: user.id,
        })
    }

    async fn verify_token(&self, token: &str) -> Result<TokenClaims, AppError> {
        let claims = verify_jwt(token, &self.config.jwt_secret)
            .map_err(|e| AppError::Unauthorized(format!("Invalid token: {}", e)))?;
        Ok(TokenClaims {
            user_id: claims.sub,
            platform: claims.platform,
        })
    }
}

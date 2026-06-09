use std::sync::Arc;

use async_trait::async_trait;
use uuid::Uuid;

use sb_contracts::repo_api::{UserInfo, UserRepo};
use sb_contracts::service_api::{AuthService, TokenClaims};
use sb_shared_types::errors::AppError;
use sb_shared_types::request_context::RequestContext;

use sb_auth::{AuthConfig, AuthServiceImpl};

// ── Mock UserRepo ──────────────────────────
struct MockUserRepo {
    users: std::sync::Mutex<Vec<UserInfo>>,
}

impl MockUserRepo {
    fn new() -> Self {
        Self { users: std::sync::Mutex::new(Vec::new()) }
    }
}

#[async_trait]
impl UserRepo for MockUserRepo {
    async fn find_or_create_by_telegram(
        &self,
        _ctx: &RequestContext,
        tg_id: i64,
    ) -> Result<UserInfo, AppError> {
        let mut users = self.users.lock().unwrap();
        if let Some(u) = users.iter().find(|u| u.telegram_id == Some(tg_id)) {
            return Ok(u.clone());
        }
        let new_user = UserInfo {
            id: Uuid::new_v4(),
            telegram_id: Some(tg_id),
            email: None,
            password_hash: String::new(),
        };
        users.push(new_user.clone());
        Ok(new_user)
    }

    async fn create_email_user(
        &self,
        _ctx: &RequestContext,
        email: &str,
        password_hash: &str,
    ) -> Result<UserInfo, AppError> {
        let mut users = self.users.lock().unwrap();
        if users.iter().any(|u| u.email.as_deref() == Some(email)) {
            return Err(AppError::conflict("Email already exists"));
        }
        let new_user = UserInfo {
            id: Uuid::new_v4(),
            telegram_id: None,
            email: Some(email.to_string()),
            password_hash: password_hash.to_string(),
        };
        users.push(new_user.clone());
        Ok(new_user)
    }

    async fn find_by_email(
        &self,
        _ctx: &RequestContext,
        email: &str,
    ) -> Result<Option<UserInfo>, AppError> {
        let users = self.users.lock().unwrap();
        Ok(users.iter().find(|u| u.email.as_deref() == Some(email)).cloned())
    }
}

fn test_service() -> (Arc<AuthServiceImpl>, Arc<MockUserRepo>) {
    let repo = Arc::new(MockUserRepo::new());
    let config = AuthConfig {
        jwt_secret: "test-secret".into(),
        bot_token: "test-bot-token".into(),
        jwt_expiry_days: 30,
    };
    let svc = Arc::new(AuthServiceImpl::new(repo.clone(), config));
    (svc, repo)
}

#[tokio::test]
async fn register_and_login_flow() {
    let (svc, _repo) = test_service();
    let ctx = RequestContext::new();

    let result = svc.register(&ctx, "user@test.com", "Password123!").await.expect("register failed");
    assert!(!result.jwt.is_empty());

    let result = svc.login(&ctx, "user@test.com", "Password123!").await.expect("login failed");
    assert!(!result.jwt.is_empty());

    let err = svc.login(&ctx, "user@test.com", "wrong").await.unwrap_err();
    assert!(err.is_unauthorized());
}

#[tokio::test]
async fn telegram_auth_mock_invalid() {
    let (svc, _repo) = test_service();
    let ctx = RequestContext::new();
    let err = svc.telegram_auth(&ctx, "invalid").await.unwrap_err();
    assert!(err.is_bad_request());
}

#[tokio::test]
async fn jwt_verification() {
    let (svc, _repo) = test_service();
    let ctx = RequestContext::new();
    let res = svc.register(&ctx, "jwt@test.com", "secret").await.unwrap();
    let claims: TokenClaims = svc.verify_token(&res.jwt).await.unwrap();
    assert_eq!(claims.platform, "email");
    assert_eq!(claims.user_id, res.user_id);
}

#[tokio::test]
async fn jwt_rejects_expired_token() {
    use chrono::{Duration, Utc};
    use jsonwebtoken::{EncodingKey, Header};
    let (svc, _repo) = test_service();
    let expired_claims = sb_auth::jwt::Claims {
        sub: Uuid::new_v4(),
        platform: "email".into(),
        exp: (Utc::now() - Duration::days(1)).timestamp() as usize,
        iat: 0,
    };
    let token = jsonwebtoken::encode(
        &Header::default(),
        &expired_claims,
        &EncodingKey::from_secret(b"test-secret"),
    ).unwrap();
    let err = svc.verify_token(&token).await.unwrap_err();
    assert!(err.is_unauthorized());
}

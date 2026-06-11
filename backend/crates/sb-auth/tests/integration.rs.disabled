use async_trait::async_trait;
use std::sync::Arc;
use uuid::Uuid;

use sb_contracts::repo_api::{UserInfo, UserRepo};
use sb_contracts::service_api::AuthService;
use sb_shared_types::errors::AppError;
use sb_shared_types::request_context::RequestContext;
use secrecy::SecretString;

use sb_auth::{AuthConfig, AuthServiceImpl};

struct MockUserRepo {
    users: std::sync::Mutex<Vec<UserInfo>>,
}

impl MockUserRepo {
    fn new() -> Self {
        Self {
            users: std::sync::Mutex::new(Vec::new()),
        }
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
        let u = UserInfo {
            id: Uuid::new_v4(),
            telegram_id: Some(tg_id),
            email: None,
            password_hash: String::new(),
        };
        users.push(u.clone());
        Ok(u)
    }
    async fn create_email_user(
        &self,
        _ctx: &RequestContext,
        email: &str,
        password_hash: &str,
    ) -> Result<UserInfo, AppError> {
        let mut users = self.users.lock().unwrap();
        if users.iter().any(|u| u.email.as_deref() == Some(email)) {
            return Err(AppError::Conflict("Email exists".into()));
        }
        let u = UserInfo {
            id: Uuid::new_v4(),
            telegram_id: None,
            email: Some(email.into()),
            password_hash: password_hash.into(),
        };
        users.push(u.clone());
        Ok(u)
    }
    async fn find_by_email(
        &self,
        _ctx: &RequestContext,
        email: &str,
    ) -> Result<Option<UserInfo>, AppError> {
        Ok(self
            .users
            .lock()
            .unwrap()
            .iter()
            .find(|u| u.email.as_deref() == Some(email))
            .cloned())
    }
}

fn test_service() -> (Arc<AuthServiceImpl>, Arc<MockUserRepo>) {
    let repo = Arc::new(MockUserRepo::new());
    let config = AuthConfig {
        jwt_secret: SecretString::from("secret".to_string()),
        bot_token: SecretString::from("bot".to_string()),
        jwt_expiry_days: 30,
    };
    (Arc::new(AuthServiceImpl::new(repo.clone(), config)), repo)
}

#[tokio::test]
async fn register_login_flow() {
    let (svc, _) = test_service();
    let ctx = RequestContext::new(Uuid::new_v4(), None);
    let r = svc.register(&ctx, "a@b.com", "Pass1234!").await.unwrap();
    assert!(!r.jwt.is_empty());
    let r2 = svc.login(&ctx, "a@b.com", "Pass1234!").await.unwrap();
    assert!(!r2.jwt.is_empty());
    let err = svc.login(&ctx, "a@b.com", "wrong").await.unwrap_err();
    assert!(matches!(err, AppError::Unauthorized(_)));
}

#[tokio::test]
async fn telegram_invalid() {
    let (svc, _) = test_service();
    let ctx = RequestContext::new(Uuid::new_v4(), None);
    let err = svc.telegram_auth(&ctx, "invalid").await.unwrap_err();
    assert!(matches!(err, AppError::InvalidInput(_)));
}

#[tokio::test]
async fn jwt_verify() {
    let (svc, _) = test_service();
    let ctx = RequestContext::new(Uuid::new_v4(), None);
    let r = svc.register(&ctx, "j@j.com", "secret123").await.unwrap();
    let claims = svc.verify_token(&r.jwt).await.unwrap();
    assert_eq!(claims.platform, "email");
}

#[tokio::test]
async fn expired_token() {
    use chrono::{Duration, Utc};
    use jsonwebtoken::{EncodingKey, Header};
    let (svc, _) = test_service();
    let claims = sb_auth::jwt::Claims {
        sub: Uuid::new_v4(),
        platform: "email".into(),
        exp: (Utc::now() - Duration::days(1)).timestamp() as usize,
        iat: 0,
    };
    let token = jsonwebtoken::encode(
        &Header::default(),
        &claims,
        &EncodingKey::from_secret(b"secret"),
    )
    .unwrap();
    let err = svc.verify_token(&token).await.unwrap_err();
    assert!(matches!(err, AppError::Unauthorized(_)));
}

#[tokio::test]
async fn password_validation() {
    let (svc, _) = test_service();
    let ctx = RequestContext::new(Uuid::new_v4(), None);
    let err = svc.register(&ctx, "a@b.com", "short").await.unwrap_err();
    assert!(matches!(err, AppError::InvalidInput(_)));
}

#[tokio::test]
async fn email_validation() {
    let (svc, _) = test_service();
    let ctx = RequestContext::new(Uuid::new_v4(), None);
    let err = svc
        .register(&ctx, "notanemail", "password123")
        .await
        .unwrap_err();
    assert!(matches!(err, AppError::InvalidInput(_)));
}

#[tokio::test]
async fn login_nonexistent_email() {
    let (svc, _) = test_service();
    let ctx = RequestContext::new(Uuid::new_v4(), None);
    let err = svc
        .login(&ctx, "ghost@example.com", "anything")
        .await
        .unwrap_err();
    assert!(matches!(err, AppError::Unauthorized(_)));
}

#[tokio::test]
async fn register_duplicate_email() {
    let (svc, _) = test_service();
    let ctx = RequestContext::new(Uuid::new_v4(), None);
    svc.register(&ctx, "dup@test.com", "Password1!")
        .await
        .unwrap();
    let err = svc
        .register(&ctx, "dup@test.com", "Password1!")
        .await
        .unwrap_err();
    assert!(matches!(err, AppError::Conflict(_)));
}

#[tokio::test]
async fn register_empty_email() {
    let (svc, _) = test_service();
    let ctx = RequestContext::new(Uuid::new_v4(), None);
    let err = svc.register(&ctx, "", "Password1!").await.unwrap_err();
    assert!(matches!(err, AppError::InvalidInput(_)));
}

#[tokio::test]
async fn register_empty_password() {
    let (svc, _) = test_service();
    let ctx = RequestContext::new(Uuid::new_v4(), None);
    let err = svc.register(&ctx, "a@b.com", "").await.unwrap_err();
    assert!(matches!(err, AppError::InvalidInput(_)));
}

#[tokio::test]
async fn verify_malformed_token() {
    let (svc, _) = test_service();
    let err = svc.verify_token("not-a-valid-jwt").await.unwrap_err();
    assert!(matches!(err, AppError::Unauthorized(_)));
}

#[tokio::test]
async fn verify_token_wrong_secret() {
    use jsonwebtoken::{EncodingKey, Header};
    let (svc, _) = test_service();
    let claims = sb_auth::jwt::Claims {
        sub: Uuid::new_v4(),
        platform: "email".into(),
        exp: (chrono::Utc::now() + chrono::Duration::days(1)).timestamp() as usize,
        iat: 0,
    };
    let token = jsonwebtoken::encode(
        &Header::default(),
        &claims,
        &EncodingKey::from_secret(b"wrong-secret"),
    )
    .unwrap();
    let err = svc.verify_token(&token).await.unwrap_err();
    assert!(matches!(err, AppError::Unauthorized(_)));
}

#[tokio::test]
async fn authenticate_valid_token() {
    use sb_contracts::service_api::AuthService;
    let (svc, _) = test_service();
    let ctx = RequestContext::new(Uuid::new_v4(), None);
    let reg = svc
        .register(&ctx, "auth-test@test.com", "Secret123")
        .await
        .unwrap();
    let user_id = svc.authenticate(&reg.jwt, &ctx).await.unwrap();
    assert_eq!(user_id.0, reg.user_id);
}

#[tokio::test]
async fn authenticate_expired_token() {
    use chrono::{Duration, Utc};
    use jsonwebtoken::{EncodingKey, Header};
    use sb_contracts::service_api::AuthService;
    let (svc, _) = test_service();
    let ctx = RequestContext::new(Uuid::new_v4(), None);
    let expired_claims = sb_auth::jwt::Claims {
        sub: Uuid::new_v4(),
        platform: "email".into(),
        exp: (Utc::now() - Duration::days(1)).timestamp() as usize,
        iat: 0,
    };
    let token = jsonwebtoken::encode(
        &Header::default(),
        &expired_claims,
        &EncodingKey::from_secret(b"secret"),
    )
    .unwrap();
    let err = svc.authenticate(&token, &ctx).await.unwrap_err();
    assert!(matches!(err, AppError::Unauthorized(_)));
}

#[tokio::test]
async fn telegram_auth_empty_initdata() {
    let (svc, _) = test_service();
    let ctx = RequestContext::new(Uuid::new_v4(), None);
    let err = svc.telegram_auth(&ctx, "").await.unwrap_err();
    assert!(matches!(err, AppError::InvalidInput(_)));
}

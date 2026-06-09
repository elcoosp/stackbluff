
use std::sync::Arc;
use uuid::Uuid;
use async_trait::async_trait;

use sb_contracts::repo_api::{UserInfo, UserRepo};
use sb_contracts::service_api::AuthService;
use sb_shared_types::errors::AppError;
use sb_shared_types::request_context::RequestContext;

use sb_auth::{AuthConfig, AuthServiceImpl};

use std::sync::Once;
static INIT: Once = Once::new();
fn init() {
    INIT.call_once(|| {
        sb_auth::jwt::init_crypto();
    });
}
struct MockUserRepo {
    users: std::sync::Mutex<Vec<UserInfo>>,
}

impl MockUserRepo {
    fn new() -> Self { Self { users: std::sync::Mutex::new(Vec::new()) } }
}

#[async_trait]
impl UserRepo for MockUserRepo {
    async fn find_or_create_by_telegram(&self, _ctx: &RequestContext, tg_id: i64) -> Result<UserInfo, AppError> {
        let mut users = self.users.lock().unwrap();
        if let Some(u) = users.iter().find(|u| u.telegram_id == Some(tg_id)) { return Ok(u.clone()); }
        let u = UserInfo { id: Uuid::new_v4(), telegram_id: Some(tg_id), email: None, password_hash: String::new() };
        users.push(u.clone());
        Ok(u)
    }
    async fn create_email_user(&self, _ctx: &RequestContext, email: &str, password_hash: &str) -> Result<UserInfo, AppError> {
        let mut users = self.users.lock().unwrap();
        if users.iter().any(|u| u.email.as_deref() == Some(email)) { return Err(AppError::Conflict("Email exists".into())); }
        let u = UserInfo { id: Uuid::new_v4(), telegram_id: None, email: Some(email.into()), password_hash: password_hash.into() };
        users.push(u.clone());
        Ok(u)
    }
    async fn find_by_email(&self, _ctx: &RequestContext, email: &str) -> Result<Option<UserInfo>, AppError> {
        Ok(self.users.lock().unwrap().iter().find(|u| u.email.as_deref() == Some(email)).cloned())
    }
}

fn test_service() -> (Arc<AuthServiceImpl>, Arc<MockUserRepo>) {
    let repo = Arc::new(MockUserRepo::new());
    let config = AuthConfig { jwt_secret: "secret".into(), bot_token: "bot".into(), jwt_expiry_days: 30 };
    (Arc::new(AuthServiceImpl::new(repo.clone(), config)), repo)
}

#[tokio::test]
async fn register_login_flow() {
    init();
    let (svc, _) = test_service();
    let ctx = RequestContext::new(Uuid::new_v4(), None);
    let r = svc.register(&ctx, "a@b.com", "Pass1!").await.unwrap();
    assert!(!r.jwt.is_empty());
    let r2 = svc.login(&ctx, "a@b.com", "Pass1!").await.unwrap();
    assert!(!r2.jwt.is_empty());
    let err = svc.login(&ctx, "a@b.com", "wrong").await.unwrap_err();
    assert!(format!("{:?}", err).contains("Unauthorized"));
}

#[tokio::test]
async fn telegram_invalid() {
    init();
    let (svc, _) = test_service();
    let ctx = RequestContext::new(Uuid::new_v4(), None);
    let err = svc.telegram_auth(&ctx, "invalid").await.unwrap_err();
    assert!(format!("{:?}", err).contains("InvalidInput"));
}

#[tokio::test]
async fn jwt_verify() {
    init();
    let (svc, _) = test_service();
    let ctx = RequestContext::new(Uuid::new_v4(), None);
    let r = svc.register(&ctx, "j@j.com", "secret").await.unwrap();
    let claims = svc.verify_token(&r.jwt).await.unwrap();
    assert_eq!(claims.platform, "email");
}

#[tokio::test]
async fn expired_token() {
    init();
    use chrono::{Duration, Utc};
    use jsonwebtoken::{EncodingKey, Header};
    let (svc, _) = test_service();
    let claims = sb_auth::jwt::Claims {
        sub: Uuid::new_v4(), platform: "email".into(), exp: (Utc::now() - Duration::days(1)).timestamp() as usize, iat: 0
    };
    let token = jsonwebtoken::encode(&Header::default(), &claims, &EncodingKey::from_secret(b"secret")).unwrap();
    let err = svc.verify_token(&token).await.unwrap_err();
    assert!(format!("{:?}", err).contains("Unauthorized"));
}

use crate::{HandAnalysisParams, OracleServiceImpl, SessionManager};
use sb_contracts::repo_api::{PersistenceError, UserProfile, UserRepo, UserCreate};
use sb_contracts::service_api::OracleService;
use sb_shared_types::{RequestContext, UserId};
use std::sync::Arc;
use chrono::{DateTime, Utc, Duration};
use async_trait::async_trait;
use uuid::Uuid;

struct MockUserRepo {
    expires_at: Option<DateTime<Utc>>,
}

#[async_trait]
impl UserRepo for MockUserRepo {
    async fn create_user(&self, _ctx: RequestContext, _create: UserCreate) -> Result<UserId, PersistenceError> { unimplemented!() }
    async fn get_user(&self, _ctx: RequestContext, _id: UserId) -> Result<String, PersistenceError> { unimplemented!() }
    async fn get_user_profile(&self, _ctx: RequestContext, _id: UserId) -> Result<UserProfile, PersistenceError> { unimplemented!() }
    async fn update_chip_balance(&self, _ctx: RequestContext, _user_id: UserId, _delta: i64) -> Result<i64, PersistenceError> { unimplemented!() }
    async fn update_chip_balance_with_conn(&self, _conn: &sea_orm::DatabaseConnection, _ctx: RequestContext, _user_id: UserId, _delta: i64) -> Result<i64, PersistenceError> { unimplemented!() }
    async fn find_or_create_by_telegram(&self, _ctx: RequestContext, _tg_id: i64) -> Result<UserId, PersistenceError> { unimplemented!() }
    async fn create_email_user(&self, _ctx: RequestContext, _username: &str, _email: &str, _password_hash: &str) -> Result<UserId, PersistenceError> { unimplemented!() }
    async fn find_by_email(&self, _ctx: RequestContext, _email: &str) -> Result<Option<UserId>, PersistenceError> { unimplemented!() }
    async fn has_active_season_pass(&self, _ctx: RequestContext, _user_id: UserId) -> Result<bool, PersistenceError> {
        Ok(self.expires_at.map(|exp| exp > Utc::now()).unwrap_or(false))
    }
}

fn test_ctx() -> RequestContext {
    RequestContext::new(Uuid::new_v4(), Some(UserId::new(Uuid::new_v4())))
}

fn test_params() -> HandAnalysisParams {
    HandAnalysisParams {
        hole_cards: ["AS".to_string(), "KS".to_string()],
        community_cards: vec![],
        pot_size: 100,
        stack_size: 1000,
        pot_odds_ratio: 2.0,
        hand_strength: 0.8,
        position: "BTN".to_string(),
        stack_bb: 100.0,
        is_bluff_catching: false,
        is_cbet_situation: true,
    }
}

#[tokio::test]
async fn active_pass_bypasses_limit() {
    let session = SessionManager::new();
    let repo = Arc::new(MockUserRepo { expires_at: Some(Utc::now() + Duration::hours(1)) });
    let oracle = OracleServiceImpl::new(session, repo, None);
    let ctx = test_ctx();
    let params = test_params();
    for _ in 0..5 {
        let result: Result<_, _> = oracle.analyze(&ctx, params.clone()).await;
        assert!(result.is_ok());
    }
}

#[tokio::test]
async fn expired_pass_behaves_like_free_user() {
    let session = SessionManager::new();
    let repo = Arc::new(MockUserRepo { expires_at: Some(Utc::now() - Duration::hours(1)) });
    let oracle = OracleServiceImpl::new(session, repo, None);
    let ctx = test_ctx();
    let params = test_params();
    for _ in 0..3 {
        let result: Result<_, _> = oracle.analyze(&ctx, params.clone()).await;
        assert!(result.is_ok());
    }
    let result: Result<_, _> = oracle.analyze(&ctx, params.clone()).await;
    assert!(matches!(result, Err(crate::OracleError::LimitReached { .. })));
}

#[tokio::test]
async fn remaining_endpoint_for_pass_holder() {
    let session = SessionManager::new();
    let repo = Arc::new(MockUserRepo { expires_at: Some(Utc::now() + Duration::hours(1)) });
    let oracle = OracleServiceImpl::new(session, repo, None);
    let ctx = test_ctx();
    let resp = oracle.remaining_analyses(&ctx).await.unwrap();
    assert!(resp.unlimited);
}

#[tokio::test]
async fn remaining_endpoint_for_free_user() {
    let session = SessionManager::new();
    let repo = Arc::new(MockUserRepo { expires_at: None });
    let oracle = OracleServiceImpl::new(session, repo, None);
    let ctx = test_ctx();
    let resp = oracle.remaining_analyses(&ctx).await.unwrap();
    assert!(!resp.unlimited);
    assert_eq!(resp.remaining, 3);
}

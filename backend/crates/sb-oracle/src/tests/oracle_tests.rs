use crate::{HandAnalysisParams, OracleServiceImpl, SessionManager};
use async_trait::async_trait;
use mockall::mock;
use sb_contracts::repo_api::{PersistenceError, UserCreate, UserProfile, UserRepo, UserWithHash};
use sb_contracts::service_api::OracleService;
use sb_shared_types::{RequestContext, UserId};
use std::sync::Arc;
use uuid::Uuid;

mock! {
    UserRepo {}
    #[async_trait]
    impl UserRepo for UserRepo {
        async fn create_user(&self, ctx: RequestContext, create: UserCreate) -> Result<UserId, PersistenceError>;
        async fn get_user(&self, ctx: RequestContext, id: UserId) -> Result<String, PersistenceError>;
        async fn get_user_profile(&self, ctx: RequestContext, id: UserId) -> Result<UserProfile, PersistenceError>;
        async fn update_chip_balance(&self, ctx: RequestContext, user_id: UserId, delta: i64) -> Result<i64, PersistenceError>;
        async fn update_chip_balance_with_conn(&self, conn: &sea_orm::DatabaseConnection, ctx: RequestContext, user_id: UserId, delta: i64) -> Result<i64, PersistenceError>;
        async fn find_or_create_by_telegram(&self, ctx: RequestContext, tg_id: i64) -> Result<UserId, PersistenceError>;
        async fn create_email_user(&self, ctx: RequestContext, username: &str, email: &str, password_hash: &str) -> Result<UserId, PersistenceError>;
        async fn find_by_email(&self, ctx: RequestContext, email: &str) -> Result<Option<UserId>, PersistenceError>;
        async fn find_by_email_with_hash(&self, ctx: RequestContext, email: &str) -> Result<Option<UserWithHash>, PersistenceError>;
        async fn mark_email_verified(&self, ctx: RequestContext, user_id: UserId) -> Result<(), PersistenceError>;
        async fn update_password(&self, ctx: RequestContext, user_id: UserId, new_password_hash: &str) -> Result<(), PersistenceError>;
        async fn update_password_with_timestamp(&self, ctx: RequestContext, user_id: UserId, new_password_hash: &str) -> Result<(), PersistenceError>;
        async fn is_email_verified(&self, ctx: RequestContext, user_id: UserId) -> Result<bool, PersistenceError>;
        async fn has_active_season_pass(&self, ctx: RequestContext, user_id: UserId) -> Result<bool, PersistenceError>;
        async fn find_by_telegram(&self, ctx: RequestContext, tg_id: i64) -> Result<Option<UserId>, PersistenceError>;
    

        async fn extend_season_pass(
            &self,
            _ctx: sb_shared_types::RequestContext,
            _user_id: sb_shared_types::UserId,
            _duration_days: i64,
        ) -> Result<(), sb_contracts::persistence_error::PersistenceError>;

        async fn extend_club_pro(
            &self,
            _ctx: sb_shared_types::RequestContext,
            _user_id: sb_shared_types::UserId,
            _duration_days: i64,
        ) -> Result<(), sb_contracts::persistence_error::PersistenceError>;
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
    let mut repo = MockUserRepo::new();
    repo.expect_has_active_season_pass()
        .times(5)
        .returning(|_, _| Ok(true));

    let session = SessionManager::new();
    let oracle = OracleServiceImpl::new(session, Arc::new(repo), None);
    let ctx = test_ctx();
    let params = test_params();

    for _ in 0..5 {
        let result: Result<_, _> = oracle.analyze(&ctx, params.clone()).await;
        assert!(result.is_ok());
    }
}

#[tokio::test]
async fn expired_pass_behaves_like_free_user() {
    let mut repo = MockUserRepo::new();
    repo.expect_has_active_season_pass()
        .times(4)
        .returning(|_, _| Ok(false));

    let session = SessionManager::new();
    let oracle = OracleServiceImpl::new(session, Arc::new(repo), None);
    let ctx = test_ctx();
    let params = test_params();

    for _ in 0..3 {
        let result: Result<_, _> = oracle.analyze(&ctx, params.clone()).await;
        assert!(result.is_ok());
    }

    let result: Result<_, _> = oracle.analyze(&ctx, params.clone()).await;
    assert!(matches!(
        result,
        Err(crate::OracleError::LimitReached { .. })
    ));
}

#[tokio::test]
async fn remaining_endpoint_for_pass_holder() {
    let mut repo = MockUserRepo::new();
    repo.expect_has_active_season_pass()
        .once()
        .returning(|_, _| Ok(true));

    let session = SessionManager::new();
    let oracle = OracleServiceImpl::new(session, Arc::new(repo), None);
    let ctx = test_ctx();
    let resp = oracle.remaining_analyses(&ctx).await.unwrap();
    assert!(resp.unlimited);
}

#[tokio::test]
async fn remaining_endpoint_for_free_user() {
    let mut repo = MockUserRepo::new();
    repo.expect_has_active_season_pass()
        .once()
        .returning(|_, _| Ok(false));

    let session = SessionManager::new();
    let oracle = OracleServiceImpl::new(session, Arc::new(repo), None);
    let ctx = test_ctx();
    let resp = oracle.remaining_analyses(&ctx).await.unwrap();
    assert!(!resp.unlimited);
    assert_eq!(resp.remaining, 3);
}

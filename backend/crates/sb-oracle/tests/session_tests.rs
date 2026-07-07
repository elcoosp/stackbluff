use sb_contracts::repo_api::{PersistenceError, UserCreate, UserProfile, UserRepo, UserWithHash};
use sb_oracle::{OracleServiceImpl, SessionManager};
use sb_shared_types::{RequestContext, UserId};
use std::sync::Arc;

struct DummyRepo;

#[async_trait::async_trait]
impl UserRepo for DummyRepo {
    async fn create_user(
        &self,
        _ctx: RequestContext,
        _create: UserCreate,
    ) -> Result<UserId, PersistenceError> {
        unimplemented!()
    }
    async fn get_user(
        &self,
        _ctx: RequestContext,
        _id: UserId,
    ) -> Result<String, PersistenceError> {
        unimplemented!()
    }
    async fn get_user_profile(
        &self,
        _ctx: RequestContext,
        _id: UserId,
    ) -> Result<UserProfile, PersistenceError> {
        unimplemented!()
    }
    async fn update_chip_balance(
        &self,
        _ctx: RequestContext,
        _user_id: UserId,
        _delta: i64,
    ) -> Result<i64, PersistenceError> {
        unimplemented!()
    }
    async fn update_chip_balance_with_conn(
        &self,
        _conn: &sea_orm::DatabaseConnection,
        _ctx: RequestContext,
        _user_id: UserId,
        _delta: i64,
    ) -> Result<i64, PersistenceError> {
        unimplemented!()
    }
    async fn find_or_create_by_telegram(
        &self,
        _ctx: RequestContext,
        _tg_id: i64,
    ) -> Result<UserId, PersistenceError> {
        unimplemented!()
    }
    async fn create_email_user(
        &self,
        _ctx: RequestContext,
        _username: &str,
        _email: &str,
        _password_hash: &str,
    ) -> Result<UserId, PersistenceError> {
        unimplemented!()
    }
    async fn find_by_email(
        &self,
        _ctx: RequestContext,
        _email: &str,
    ) -> Result<Option<UserId>, PersistenceError> {
        unimplemented!()
    }
    async fn find_by_email_with_hash(
        &self,
        _ctx: RequestContext,
        _email: &str,
    ) -> Result<Option<UserWithHash>, PersistenceError> {
        unimplemented!()
    }
    async fn mark_email_verified(
        &self,
        _ctx: RequestContext,
        _user_id: UserId,
    ) -> Result<(), PersistenceError> {
        unimplemented!()
    }
    async fn update_password(
        &self,
        _ctx: RequestContext,
        _user_id: UserId,
        _new_password_hash: &str,
    ) -> Result<(), PersistenceError> {
        unimplemented!()
    }
    async fn update_password_with_timestamp(
        &self,
        _ctx: RequestContext,
        _user_id: UserId,
        _new_password_hash: &str,
    ) -> Result<(), PersistenceError> {
        unimplemented!()
    }
    async fn is_email_verified(
        &self,
        _ctx: RequestContext,
        _user_id: UserId,
    ) -> Result<bool, PersistenceError> {
        unimplemented!()
    }
    async fn has_active_season_pass(
        &self,
        _ctx: RequestContext,
        _user_id: UserId,
    ) -> Result<bool, PersistenceError> {
        Ok(false)
    }
    async fn find_by_telegram(
        &self,
        _ctx: RequestContext,
        _tg_id: i64,
    ) -> Result<Option<UserId>, PersistenceError> {
        Ok(None)
    }
}

#[tokio::test]
async fn remaining_returns_max_for_new_user() {
    let session = SessionManager::new();
    let remaining = session.remaining(UserId::new(uuid::Uuid::new_v4())).await;
    assert_eq!(remaining, 3);
}

#[tokio::test]
async fn remaining_decreases_after_consume() {
    let session = SessionManager::new();
    let user_id = UserId::new(uuid::Uuid::new_v4());
    session.try_consume(user_id).await;
    let remaining = session.remaining(user_id).await;
    assert_eq!(remaining, 2);
}

#[tokio::test]
async fn remaining_zero_after_max() {
    let session = SessionManager::new();
    let user_id = UserId::new(uuid::Uuid::new_v4());
    for _ in 0..5 {
        session.try_consume(user_id).await;
    }
    let remaining = session.remaining(user_id).await;
    assert_eq!(remaining, 0);
}

#[tokio::test]
async fn oracle_service_impl_new_takes_three_args() {
    let sessions = SessionManager::new();
    let dummy_repo: Arc<dyn UserRepo> = Arc::new(DummyRepo);
    let _oracle = OracleServiceImpl::new(sessions, dummy_repo, None);
}

use async_trait::async_trait;
use sb_contracts::{PersistenceResult, User, UserCreate, UserRepository};
use sb_shared_types::UserId;

pub struct UserRepositoryImpl;

#[async_trait]
impl UserRepository for UserRepositoryImpl {
    async fn create_user(&self, _user: UserCreate) -> PersistenceResult<UserId> {
        todo!("Implement with database writer")
    }

    async fn get_user(&self, _id: UserId) -> PersistenceResult<User> {
        todo!("Implement with database reader")
    }

    async fn update_chip_balance(&self, _id: UserId, _delta: i64) -> PersistenceResult<()> {
        todo!("Implement via DbCommand channel")
    }
}

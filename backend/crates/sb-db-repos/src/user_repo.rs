use crate::commands::DbCommand;
use sb_contracts::repo_api::{PersistenceError, PersistenceResult, UserCreate, UserRepository};
use sb_shared_types::{RequestContext, UserId};
use tokio::sync::{mpsc, oneshot};

pub struct UserRepoImpl {
    sender: mpsc::UnboundedSender<DbCommand>,
}

impl UserRepoImpl {
    pub fn new(sender: mpsc::UnboundedSender<DbCommand>) -> Self {
        Self { sender }
    }
}

#[async_trait::async_trait]
impl UserRepository for UserRepoImpl {
    async fn create_user(
        &self,
        ctx: RequestContext,
        create: UserCreate,
    ) -> PersistenceResult<UserId> {
        let (tx, rx) = oneshot::channel();
        let cmd = DbCommand::CreateUser {
            ctx,
            telegram_id: create.telegram_id,
            email: create.email,
            display_name: create.display_name,
            platform: create.platform,
            respond: tx,
        };
        self.sender
            .send(cmd)
            .map_err(|e| PersistenceError::transient(e.to_string()))?;
        rx.await
            .map_err(|e| PersistenceError::transient(e.to_string()))?
    }

    async fn get_user(&self, ctx: RequestContext, id: UserId) -> PersistenceResult<String> {
        let (tx, rx) = oneshot::channel();
        let cmd = DbCommand::GetUser {
            ctx,
            id,
            respond: tx,
        };
        self.sender
            .send(cmd)
            .map_err(|e| PersistenceError::transient(e.to_string()))?;
        rx.await
            .map_err(|e| PersistenceError::transient(e.to_string()))?
    }

    async fn update_chip_balance(
        &self,
        ctx: RequestContext,
        user_id: UserId,
        delta: i64,
    ) -> PersistenceResult<()> {
        let (tx, rx) = oneshot::channel();
        let cmd = DbCommand::UpdateChipBalance {
            ctx,
            user_id,
            delta,
            respond: tx,
        };
        self.sender
            .send(cmd)
            .map_err(|e| PersistenceError::transient(e.to_string()))?;
        rx.await
            .map_err(|e| PersistenceError::transient(e.to_string()))?
    }
}

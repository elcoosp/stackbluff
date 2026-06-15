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
            respond: tx,
        };
        self.sender
            .send(cmd)
            .map_err(|e| PersistenceError::Database(e.to_string()))?;
        rx.await
            .map_err(|e| PersistenceError::Database(e.to_string()))?
    }

    async fn find_or_create_by_telegram(
        &self,
        ctx: RequestContext,
        tg_id: i64,
    ) -> PersistenceResult<UserId> {
        let (tx, rx) = oneshot::channel();
        let cmd = DbCommand::FindOrCreateByTelegram {
            ctx,
            tg_id,
            respond: tx,
        };
        self.sender
            .send(cmd)
            .map_err(|e| PersistenceError::Database(e.to_string()))?;
        rx.await
            .map_err(|e| PersistenceError::Database(e.to_string()))?
    }

    async fn create_email_user(
        &self,
        ctx: RequestContext,
        username: &str,
        email: &str,
        password_hash: &str,
    ) -> PersistenceResult<UserId> {
        let (tx, rx) = oneshot::channel();
        let cmd = DbCommand::CreateEmailUser {
            ctx,
            username: username.to_string(),
            email: email.to_string(),
            password_hash: password_hash.to_string(), // Pass it here
            respond: tx,
        };
        self.sender
            .send(cmd)
            .map_err(|e| PersistenceError::Database(e.to_string()))?;
        rx.await
            .map_err(|e| PersistenceError::Database(e.to_string()))?
    }

    async fn find_by_email(
        &self,
        ctx: RequestContext,
        email: &str,
    ) -> PersistenceResult<Option<UserId>> {
        let (tx, rx) = oneshot::channel();
        let cmd = DbCommand::FindByEmail {
            ctx,
            email: email.to_string(),
            respond: tx,
        };
        self.sender
            .send(cmd)
            .map_err(|e| PersistenceError::Database(e.to_string()))?;
        rx.await
            .map_err(|e| PersistenceError::Database(e.to_string()))?
    }

    // Added missing trait methods
    async fn get_user(&self, ctx: RequestContext, id: UserId) -> PersistenceResult<String> {
        let (tx, rx) = oneshot::channel();
        let cmd = DbCommand::GetUser {
            ctx,
            id,
            respond: tx,
        };
        self.sender
            .send(cmd)
            .map_err(|e| PersistenceError::Database(e.to_string()))?;
        rx.await
            .map_err(|e| PersistenceError::Database(e.to_string()))?
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
            .map_err(|e| PersistenceError::Database(e.to_string()))?;
        rx.await
            .map_err(|e| PersistenceError::Database(e.to_string()))?
    }
}

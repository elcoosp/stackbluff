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
        let sql = format!(
            "INSERT INTO users (telegram_id, email, display_name, platform) VALUES ({}, '{}', '{}', '{}')",
            create.telegram_id, create.email, create.display_name, create.platform
        );
        let (tx, rx) = oneshot::channel();
        let cmd = DbCommand::ExecuteRaw {
            ctx,
            sql,
            respond: tx,
        };
        self.sender
            .send(cmd)
            .map_err(|e| PersistenceError::Transient(e.to_string()))?;
        rx.await
            .map_err(|e| PersistenceError::Transient(e.to_string()))??;
        Ok(uuid::Uuid::new_v4().into())
    }

    async fn get_user(&self, ctx: RequestContext, id: UserId) -> PersistenceResult<String> {
        let sql = format!("SELECT display_name FROM users WHERE id = '{}'", id);
        let (tx, rx) = oneshot::channel();
        let cmd = DbCommand::ExecuteRaw {
            ctx,
            sql,
            respond: tx,
        };
        self.sender
            .send(cmd)
            .map_err(|e| PersistenceError::Transient(e.to_string()))?;
        rx.await
            .map_err(|e| PersistenceError::Transient(e.to_string()))??;
        Ok("test".to_string())
    }

    async fn update_chip_balance(
        &self,
        ctx: RequestContext,
        user_id: UserId,
        delta: i64,
    ) -> PersistenceResult<()> {
        let sql = format!(
            "UPDATE users SET chip_balance = chip_balance + {} WHERE id = '{}'",
            delta, user_id
        );
        let (tx, rx) = oneshot::channel();
        let cmd = DbCommand::ExecuteRaw {
            ctx,
            sql,
            respond: tx,
        };
        self.sender
            .send(cmd)
            .map_err(|e| PersistenceError::Transient(e.to_string()))?;
        rx.await
            .map_err(|e| PersistenceError::Transient(e.to_string()))??;
        Ok(())
    }
}

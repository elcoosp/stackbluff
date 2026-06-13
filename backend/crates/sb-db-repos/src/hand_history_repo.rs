use crate::commands::DbCommand;
use sb_contracts::repo_api::{HandHistoryRepository, PersistenceError, PersistenceResult};
use sb_shared_types::RequestContext;
use tokio::sync::{mpsc, oneshot};

pub struct HandHistoryRepoImpl {
    sender: mpsc::UnboundedSender<DbCommand>,
}

impl HandHistoryRepoImpl {
    pub fn new(sender: mpsc::UnboundedSender<DbCommand>) -> Self {
        Self { sender }
    }
}

#[async_trait::async_trait]
impl HandHistoryRepository for HandHistoryRepoImpl {
    async fn store_hand(
        &self,
        ctx: RequestContext,
        hand_data: serde_json::Value,
    ) -> PersistenceResult<()> {
        // Fixed: use {} directly, .to_string() is redundant and causes clippy warning
        let sql = format!("INSERT INTO hand_history (data) VALUES ('{}')", hand_data);
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

use crate::commands::DbCommand;
use sb_contracts::repo_api::{HandHistoryRepository, PersistenceError, PersistenceResult};
use sb_shared_types::RequestContext;
use tokio::sync::{mpsc, oneshot};
use uuid::Uuid;

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
        let table_id_str = hand_data["table_id"]
            .as_str()
            .ok_or_else(|| PersistenceError::database("missing table_id"))?;
        let table_id =
            Uuid::parse_str(table_id_str).map_err(|e| PersistenceError::database(e.to_string()))?;
        let played_at_str = hand_data["played_at"]
            .as_str()
            .ok_or_else(|| PersistenceError::database("missing played_at"))?;
        let played_at = chrono::DateTime::parse_from_rfc3339(played_at_str)
            .map_err(|e| PersistenceError::database(e.to_string()))?
            .with_timezone(&chrono::Utc);
        let players_json = hand_data["players"].clone();
        let actions_json = hand_data["actions"].clone();
        let result_json = hand_data["result"].clone();

        let (tx, rx) = oneshot::channel();
        let cmd = DbCommand::StoreHandHistory {
            ctx,
            table_id,
            played_at,
            players_json,
            actions_json,
            result_json,
            respond: tx,
        };
        self.sender
            .send(cmd)
            .map_err(|e| PersistenceError::database(e.to_string()))?;
        rx.await
            .map_err(|e| PersistenceError::database(e.to_string()))?
    }
}

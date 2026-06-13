use sb_contracts::repo_api::PersistenceResult;
use sb_shared_types::{RequestContext, UserId};
use tokio::sync::oneshot;
use uuid::Uuid;

pub type ResponseSender<T> = oneshot::Sender<PersistenceResult<T>>;

pub enum DbCommand {
    CreateUser {
        ctx: RequestContext,
        telegram_id: i64,
        email: String,
        display_name: String,
        platform: String,
        respond: ResponseSender<UserId>,
    },
    GetUser {
        ctx: RequestContext,
        id: UserId,
        respond: ResponseSender<String>,
    },
    UpdateChipBalance {
        ctx: RequestContext,
        user_id: UserId,
        delta: i64,
        respond: ResponseSender<()>,
    },
    StoreHandHistory {
        ctx: RequestContext,
        table_id: Uuid,
        played_at: chrono::DateTime<chrono::Utc>,
        players_json: serde_json::Value,
        actions_json: serde_json::Value,
        result_json: serde_json::Value,
        respond: ResponseSender<()>,
    },
    ExecuteRaw {
        ctx: RequestContext,
        sql: String,
        respond: ResponseSender<()>,
    },
}

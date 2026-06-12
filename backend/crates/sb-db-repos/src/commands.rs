use sb_contracts::repo_api::PersistenceResult;
use sb_shared_types::RequestContext;
use tokio::sync::oneshot;

pub type ResponseSender<T> = oneshot::Sender<PersistenceResult<T>>;

pub enum DbCommand {
    ExecuteRaw {
        ctx: RequestContext,
        sql: String,
        respond: ResponseSender<()>,
    },
}

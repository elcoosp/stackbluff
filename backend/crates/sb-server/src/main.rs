//! StackBluff server entry point.
use sb_rest_router::{oracle_router, SharedOracleService};
use sb_oracle::OracleServiceImpl;
use std::sync::Arc;
use axum::Server;
use std::net::SocketAddr;

#[tokio::main]
async fn main() {
    tracing_subscriber::fmt::init();

    let oracle_svc = Arc::new(OracleServiceImpl::new());
<<<<<<< HEAD
    // For now, serve only oracle endpoints. The existing lobby router can be merged later.
||||||| parent of 7b2689b (fix(oracle): final compilation fixes and template diversity)
=======
    // FIXME: The original lobby router (from sb-rest-router::create_router) is not mounted here.
    // It requires table_service, table_repo, and registry dependencies that are not yet provided.
    // For a complete server, merge both routers: Router::new().merge(lobby_router).merge(oracle_router).
>>>>>>> 7b2689b (fix(oracle): final compilation fixes and template diversity)
    let app = oracle_router(oracle_svc);

    let addr = SocketAddr::from(([127, 0, 0, 1], 3000));
    tracing::info!("listening on {}", addr);
    Server::bind(&addr)
        .serve(app.into_make_service())
        .await
        .unwrap();
}

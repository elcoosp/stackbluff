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
    // For now, serve only oracle endpoints. The existing lobby router can be merged later.
    let app = oracle_router(oracle_svc);

    let addr = SocketAddr::from(([127, 0, 0, 1], 3000));
    tracing::info!("listening on {}", addr);
    Server::bind(&addr)
        .serve(app.into_make_service())
        .await
        .unwrap();
}

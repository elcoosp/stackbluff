#!/usr/bin/env bash
set -euo pipefail
trap 'echo "ERROR on line $LINENO"; exit 1' ERR

cd "$(git rev-parse --show-toplevel)"

ORACLE_ROUTES="backend/crates/sb-rest-router/src/oracle_routes.rs"

# Write the resolved content (choose the style from the successful commit 0fc1cec)
cat > "$ORACLE_ROUTES" << 'EOF'
//! Oracle REST endpoints – completely separate from lobby router.
use axum::{Json, Router, extract::State, http::StatusCode, response::IntoResponse, routing::post};
use sb_contracts::service_api::OracleService;
use sb_oracle::{HandAnalysisParams, OracleError};
use sb_shared_types::RequestContext;
use std::sync::Arc;
use uuid::Uuid;

// Type alias for the shared oracle service (defined here to avoid circular deps)
pub type SharedOracleService = Arc<OracleServiceImpl>;

pub fn oracle_router(oracle: SharedOracleService) -> Router {
    Router::new()
        .route("/oracle/analyze", post(analyze_handler))
        .with_state(oracle)
}

async fn analyze_handler(
    State(oracle): State<SharedOracleService>,
    Json(params): Json<HandAnalysisParams>,
) -> impl IntoResponse {
    // TODO: Replace this mock user ID with real authentication extraction.
    let user_id = sb_shared_types::UserId::from(Uuid::new_v4());
    let ctx = RequestContext {
        request_id: Uuid::new_v4(),
        user_id: Some(user_id),
    };
    // Validate parameters
    if let Err(e) = params.validate() {
        return (StatusCode::BAD_REQUEST, e.to_string()).into_response();
    }
    match oracle.analyze(&ctx, params).await {
        Ok(output) => (StatusCode::OK, Json(output)).into_response(),
        Err(OracleError::LimitReached) => (StatusCode::TOO_MANY_REQUESTS, "Free tier limit reached").into_response(),
        Err(OracleError::NoMatchingTemplate) => (StatusCode::NOT_FOUND, "No analysis template matched").into_response(),
        Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()).into_response(),
    }
}
EOF

# Mark as resolved and commit
git add "$ORACLE_ROUTES"
git commit -m "fix(oracle_routes): resolve conflict, keep clean import style" || true

echo "Conflict resolved in $ORACLE_ROUTES"

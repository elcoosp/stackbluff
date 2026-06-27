//! Oracle REST endpoints – completely separate from lobby router.
use axum::{
    Extension, Json, Router,
    extract::State,
    http::StatusCode,
    response::IntoResponse,
    routing::{get, post},
};
use sb_contracts::service_api::OracleService;
use sb_oracle::{HandAnalysisParams, OracleError, OracleServiceImpl, RemainingResponse};
use sb_shared_types::RequestContext;
use std::sync::Arc;
use uuid::Uuid;

#[derive(Clone)]
pub struct AuthUser {
    pub user_id: Uuid,
}

pub fn oracle_routes(oracle: Arc<OracleServiceImpl>) -> Router {
    Router::new()
        .route("/oracle/analyze", post(analyze_hand))
        .route("/oracle/remaining", get(remaining_analyses))
        .with_state(oracle)
}

async fn analyze_hand(
    State(oracle): State<Arc<OracleServiceImpl>>,
    Extension(auth_user): Extension<AuthUser>,
    Json(params): Json<HandAnalysisParams>,
) -> impl IntoResponse {
    let ctx = RequestContext::new(auth_user.user_id);
    match oracle.analyze(&ctx, params).await {
        Ok(result) => (StatusCode::OK, Json(result)).into_response(),
        Err(OracleError::LimitReached { upgrade_url }) => (
            StatusCode::TOO_MANY_REQUESTS,
            Json(serde_json::json!({
                "error": "LimitReached",
                "upgrade_url": upgrade_url
            })),
        )
            .into_response(),
        Err(e) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!({ "error": e.to_string() })),
        )
            .into_response(),
    }
}

async fn remaining_analyses(
    State(oracle): State<Arc<OracleServiceImpl>>,
    Extension(auth_user): Extension<AuthUser>,
) -> impl IntoResponse {
    let ctx = RequestContext::new(auth_user.user_id);
    match oracle.remaining_analyses(&ctx).await {
        Ok(resp) => (StatusCode::OK, Json(resp)).into_response(),
        Err(e) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!({ "error": e.to_string() })),
        )
            .into_response(),
    }
}

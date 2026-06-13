//! REST router for StackBluff.
use axum::{
    extract::State,
    http::StatusCode,
    response::IntoResponse,
    routing::post,
    Json, Router,
};
use sb_contracts::service_api::OracleService;
use sb_oracle::{HandAnalysisParams, OracleServiceImpl, OracleError};
use sb_shared_types::RequestContext;
use std::sync::Arc;
use uuid::Uuid;

pub type SharedOracleService = Arc<OracleServiceImpl>;

pub fn create_router(oracle: SharedOracleService) -> Router {
    Router::new()
        .route("/oracle/analyze", post(analyze_handler))
        .with_state(oracle)
}

async fn analyze_handler(
    State(oracle): State<SharedOracleService>,
    Json(params): Json<HandAnalysisParams>,
) -> impl IntoResponse {
    let user_id = sb_shared_types::UserId::from(Uuid::new_v4());
    let ctx = RequestContext {
        request_id: Uuid::new_v4(),
        user_id: Some(user_id),
    };
    match oracle.analyze(&ctx, params).await {
        Ok(output) => (StatusCode::OK, Json(output)).into_response(),
        Err(OracleError::LimitReached) => (StatusCode::TOO_MANY_REQUESTS, "Free tier limit reached").into_response(),
        Err(OracleError::NoMatchingTemplate) => (StatusCode::NOT_FOUND, "No analysis template matched").into_response(),
        Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()).into_response(),
    }
}

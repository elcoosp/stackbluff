//! Oracle REST endpoints (separate router to avoid conflicts).
use axum::{Json, Router, extract::State, http::StatusCode, response::IntoResponse, routing::post};
use sb_contracts::service_api::OracleService;
<<<<<<< HEAD
use sb_oracle::{HandAnalysisParams, OracleError, OracleServiceImpl};
use sb_shared_types::RequestContext;
use uuid::Uuid;

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
    let user_id = sb_shared_types::UserId::from(Uuid::new_v4());
    let ctx = RequestContext {
        request_id: Uuid::new_v4(),
        user_id: Some(user_id),
    };
||||||| parent of 7b2689b (fix(oracle): final compilation fixes and template diversity)
=======
use sb_oracle::{HandAnalysisParams, OracleError};
use sb_shared_types::RequestContext;
use uuid::Uuid;

use super::SharedOracleService;

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
    // In production, the user_id must come from the request context (e.g., from a JWT middleware).
    let user_id = sb_shared_types::UserId::from(Uuid::new_v4());
    let ctx = RequestContext {
        request_id: Uuid::new_v4(),
        user_id: Some(user_id),
    };
    // Validate parameters
    if let Err(e) = params.validate() {
        return (StatusCode::BAD_REQUEST, e.to_string()).into_response();
    }
>>>>>>> 7b2689b (fix(oracle): final compilation fixes and template diversity)
    match oracle.analyze(&ctx, params).await {
        Ok(output) => (StatusCode::OK, Json(output)).into_response(),
        Err(OracleError::LimitReached) => {
            (StatusCode::TOO_MANY_REQUESTS, "Free tier limit reached").into_response()
        }
        Err(OracleError::NoMatchingTemplate) => {
            (StatusCode::NOT_FOUND, "No analysis template matched").into_response()
        }
        Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()).into_response(),
    }
}

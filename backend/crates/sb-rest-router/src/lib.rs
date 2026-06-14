use axum::{
    Router,
    extract::{Extension, State},
    http::StatusCode,
    response::Json,
    routing::{get, post},
};
use sb_auth::AuthUser;
use sb_contracts::lobby_api::{TableInfo, TableRepo, TableService};
use sb_shared_types::{StakeLevel, TableId};
use sb_table_registry::registry::Registry;
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tracing::error;

#[derive(Debug, Serialize)]
pub struct LobbyTableInfo {
    pub table_id: TableId,
    pub stake_level: StakeLevel,
    pub current_players: u32,
    pub max_players: u32,
    pub status: String,
}

impl From<TableInfo> for LobbyTableInfo {
    fn from(t: TableInfo) -> Self {
        LobbyTableInfo {
            table_id: t.table_id,
            stake_level: t.stake_level,
            current_players: t.current_players,
            max_players: t.max_players,
            status: t.status,
        }
    }
}

#[derive(Debug, Deserialize)]
pub struct CreateTableRequest {
    pub stake_level: StakeLevel,
    pub max_players: u32,
}

#[derive(Debug, Serialize)]
pub struct CreateTableResponse {
    pub table_id: TableId,
}

#[derive(Debug, Serialize)]
pub struct ErrorResponse {
    pub error: ErrorDetail,
}

#[derive(Debug, Serialize)]
pub struct ErrorDetail {
    pub code: String,
    pub message: String,
}

pub struct AppState {
    table_service: Arc<dyn TableService + Send + Sync>,
    table_repo: Arc<dyn TableRepo + Send + Sync>,
    registry: Arc<Registry>,
}

pub fn create_router(
    table_service: Arc<dyn TableService + Send + Sync>,
    table_repo: Arc<dyn TableRepo + Send + Sync>,
    registry: Arc<Registry>,
) -> Router {
    let state = Arc::new(AppState {
        table_service,
        table_repo,
        registry,
    });
    Router::new()
        .route("/lobby", get(lobby_handler))
        .route("/tables", post(create_table_handler))
        .layer(axum::middleware::from_fn(sb_auth::auth_middleware))
        .with_state(state)
}

#[axum::debug_handler]
async fn lobby_handler(
    Extension(_auth_user): Extension<AuthUser>,
    State(state): State<Arc<AppState>>,
) -> Result<Json<Vec<LobbyTableInfo>>, (StatusCode, Json<ErrorResponse>)> {
    let persistent = state
        .table_repo
        .list_tables()
        .await
        .map_err(internal_error)?;
    let active = state.registry.list_active_tables().await;

    let mut merged: Vec<LobbyTableInfo> = persistent.into_iter().map(Into::into).collect();
    for a in active {
        if !merged.iter().any(|m| m.table_id == a.table_id) {
            merged.push(a.into());
        }
    }
    Ok(Json(merged))
}

#[axum::debug_handler]
async fn create_table_handler(
    Extension(_auth_user): Extension<AuthUser>,
    State(state): State<Arc<AppState>>,
    Json(req): Json<CreateTableRequest>,
) -> Result<Json<CreateTableResponse>, (StatusCode, Json<ErrorResponse>)> {
    if req.max_players < 2 || req.max_players > 9 {
        return Err(bad_request(
            "INVALID_MAX_PLAYERS",
            "max_players must be between 2 and 9",
        ));
    }
    let table_id = state
        .table_service
        .create_cash_table(req.stake_level, req.max_players)
        .await
        .map_err(internal_error)?;
    Ok(Json(CreateTableResponse { table_id }))
}

fn internal_error<E: std::fmt::Display>(err: E) -> (StatusCode, Json<ErrorResponse>) {
    error!("Internal error: {}", err);
    (
        StatusCode::INTERNAL_SERVER_ERROR,
        Json(ErrorResponse {
            error: ErrorDetail {
                code: "INTERNAL_ERROR".to_string(),
                message: "Something went wrong".to_string(),
            },
        }),
    )
}

fn bad_request(code: &str, msg: &str) -> (StatusCode, Json<ErrorResponse>) {
    (
        StatusCode::BAD_REQUEST,
        Json(ErrorResponse {
            error: ErrorDetail {
                code: code.to_string(),
                message: msg.to_string(),
            },
        }),
    )
}
pub mod oracle_routes;
pub use oracle_routes::oracle_router;

// Add .route("/referrals/stats", get(referral_stats_handler)) to your router.

async fn referral_stats_handler(
    State(viral): State<Arc<dyn ViralService>>,
    user: UserId,
    req: Request<Body>,
) -> impl IntoResponse {
    // Extract request_id from headers or generate one
    let request_id = req
        .headers()
        .get("x-request-id")
        .and_then(|v| v.to_str().ok())
        .unwrap_or_else(|| "unknown");
    let span = tracing::info_span!("referral_stats", request_id = %request_id);
    let _enter = span.enter();

    match viral.get_referral_stats(user).await {
        Ok(stats) => (StatusCode::OK, Json(stats)).into_response(),
        Err(e) => {
            tracing::error!(error = %e, "Failed to retrieve referral stats");
            let error_body = serde_json::json!({
                "error": format!("{:?}", e),
                "message": "Failed to retrieve referral stats"
            });
            (StatusCode::INTERNAL_SERVER_ERROR, Json(error_body)).into_response()
        }
    }
}
pub mod rate_limit;
pub use rate_limit::rate_limit_middleware;

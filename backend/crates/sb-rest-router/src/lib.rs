pub mod leaderboard;
use axum::{
    Router,
    extract::{Extension, Path, Query, State},
    http::StatusCode,
    response::Json,
    routing::{get, post},
};
use base64::prelude::*;
use chrono::{DateTime, Utc};
use sb_auth::middleware::{AuthUser, auth_middleware};
use sb_contracts::lobby_api::{TableInfo, TableRepo, TableService};
use sb_contracts::repo_api::{HandHistoryRepository, HandSummary};
use sb_shared_types::{RequestContext, StakeLevel, TableId, UserId};
use sb_table_registry::registry::Registry;
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tracing::error;
use uuid::Uuid;

pub mod oracle_routes;
pub mod player_stats;
pub mod rate_limit;
pub mod tournament_routes;

pub use oracle_routes::oracle_router;
pub use rate_limit::rate_limit_middleware;

#[derive(Debug, Serialize)]
pub struct LobbyTableInfo {
    pub table_id: TableId,
    pub name: String,
    pub stake_level: StakeLevel,
    pub current_players: u32,
    pub max_players: u32,
    pub status: String,
}

impl From<TableInfo> for LobbyTableInfo {
    fn from(t: TableInfo) -> Self {
        LobbyTableInfo {
            table_id: t.table_id,
            name: t.name,
            stake_level: t.stake_level,
            current_players: t.current_players,
            max_players: t.max_players,
            status: t.status,
        }
    }
}

#[derive(Debug, Deserialize)]
pub struct CreateTableRequest {
    pub name: Option<String>,
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

// === Public (no auth) table listing types ===

#[derive(Debug, Serialize)]
pub struct PublicTableInfo {
    pub table_id: TableId,
    pub stake_level: StakeLevel,
    pub max_players: u32,
}

#[derive(Debug, Serialize)]
pub struct PublicTableList {
    pub tables: Vec<PublicTableInfo>,
}

// === History Request/Response Types ===

#[derive(Debug, Deserialize)]
pub struct HistoryParams {
    pub limit: Option<u64>,
    pub cursor: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct HistoryResponse {
    pub histories: Vec<HandSummary>,
    pub total: u64,
    pub next_cursor: Option<String>,
}

pub struct AppState {
    table_service: Arc<dyn TableService + Send + Sync>,
    table_repo: Arc<dyn TableRepo + Send + Sync>,
    registry: Arc<Registry>,
    hand_history_repo: Arc<dyn HandHistoryRepository + Send + Sync>,
    pub leaderboard_query: Arc<dyn sb_contracts::leaderboard::LeaderboardQuery + Send + Sync>,
}

pub fn create_router(
    table_service: Arc<dyn TableService + Send + Sync>,
    table_repo: Arc<dyn TableRepo + Send + Sync>,
    registry: Arc<Registry>,
    hand_history_repo: Arc<dyn HandHistoryRepository + Send + Sync>,
    leaderboard_query: Arc<dyn sb_contracts::leaderboard::LeaderboardQuery + Send + Sync>,
) -> Router {
    let state = Arc::new(AppState {
        table_service,
        table_repo,
        registry,
        hand_history_repo,
        leaderboard_query,
    });

    let public_routes = Router::new().route("/api/tables", get(list_tables_public));

    let protected_routes = Router::new()
        .route("/lobby", get(lobby_handler))
        .route("/tables", post(create_table_handler))
        .route("/tables/{table_id}/history", get(table_history_handler))
        .layer(axum::middleware::from_fn(auth_middleware));

    Router::new()
        .merge(public_routes)
        .merge(leaderboard::leaderboard_routes())
        .merge(protected_routes)
        .with_state(state)
}

async fn list_tables_public(State(state): State<Arc<AppState>>) -> Json<PublicTableList> {
    let tables = state.table_repo.list_tables().await.unwrap_or_default();
    Json(PublicTableList {
        tables: tables
            .into_iter()
            .map(|t| PublicTableInfo {
                table_id: t.table_id,
                stake_level: t.stake_level,
                max_players: t.max_players,
            })
            .collect(),
    })
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

    let mut merged: Vec<LobbyTableInfo> = Vec::new();
    for t in persistent {
        let active_players = state.registry.get_total_active_players(t.table_id).await;
        merged.push(LobbyTableInfo {
            table_id: t.table_id,
            name: t.name,
            stake_level: t.stake_level,
            current_players: active_players,
            max_players: t.max_players,
            status: t.status,
        });
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

async fn table_history_handler(
    Extension(auth_user): Extension<AuthUser>,
    State(state): State<Arc<AppState>>,
    Path(table_id): Path<TableId>,
    Query(params): Query<HistoryParams>,
) -> Result<Json<HistoryResponse>, (StatusCode, Json<ErrorResponse>)> {
    let user_id = UserId::new(
        Uuid::parse_str(&auth_user.user_id)
            .map_err(|_| bad_request("INVALID_USER", "Invalid user ID"))?,
    );
    let ctx = RequestContext::new(Uuid::new_v4(), Some(user_id));

    // ── Authorization ──
    let is_at_table = state.registry.is_user_at_table(table_id, user_id).await;
    let user_hand_count = state
        .hand_history_repo
        .count_user_hands(ctx.clone(), table_id, user_id)
        .await
        .map_err(internal_error)?;
    if !is_at_table && user_hand_count == 0 {
        return Err(forbidden(
            "You are not authorized to view this table's history",
        ));
    }

    // ── Parse cursor ──
    let cursor = match params.cursor {
        Some(encoded) => {
            let decoded = BASE64_STANDARD
                .decode(encoded.as_bytes())
                .map_err(|_| bad_request("INVALID_CURSOR", "Cursor must be base64"))?;
            let s = String::from_utf8(decoded)
                .map_err(|_| bad_request("INVALID_CURSOR", "Invalid UTF-8 in cursor"))?;
            let parts: Vec<&str> = s.split(',').collect();
            if parts.len() != 2 {
                return Err(bad_request(
                    "INVALID_CURSOR",
                    "Cursor must be 'played_at,id'",
                ));
            }
            let played_at = DateTime::parse_from_rfc3339(parts[0])
                .map_err(|_| bad_request("INVALID_CURSOR", "Invalid timestamp in cursor"))?
                .with_timezone(&Utc);
            let id = Uuid::parse_str(parts[1])
                .map_err(|_| bad_request("INVALID_CURSOR", "Invalid UUID in cursor"))?;
            Some((played_at, id))
        }
        None => None,
    };

    // ── Fetch data ──
    let limit = params.limit.unwrap_or(20).min(100);
    let (summaries, next_cursor) = state
        .hand_history_repo
        .list_hand_summaries(ctx.clone(), table_id, limit, cursor)
        .await
        .map_err(internal_error)?;
    let total = state
        .hand_history_repo
        .count_hand_histories(ctx, table_id)
        .await
        .map_err(internal_error)?;

    let next_cursor_b64 = next_cursor.map(|(dt, id)| {
        let s = format!("{},{}", dt.to_rfc3339(), id);
        BASE64_STANDARD.encode(s.as_bytes())
    });

    Ok(Json(HistoryResponse {
        histories: summaries,
        total,
        next_cursor: next_cursor_b64,
    }))
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

fn forbidden(msg: &str) -> (StatusCode, Json<ErrorResponse>) {
    (
        StatusCode::FORBIDDEN,
        Json(ErrorResponse {
            error: ErrorDetail {
                code: "FORBIDDEN".to_string(),
                message: msg.to_string(),
            },
        }),
    )
}
pub mod routes;

pub fn register_metrics(registry: &prometheus::Registry) {
    sb_viral::puzzle::service::register_metrics(registry);
}

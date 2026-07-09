use axum::{
    Json, Router,
    extract::{Extension, Path, State, Query},
    http::StatusCode,
    routing::{get, post},
};
use sb_contracts::tournament_api::TournamentService;
use sb_shared_types::{AppError, TournamentId, UserId};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use uuid::Uuid;

use sb_auth::middleware::AuthUser;
use sb_db_repos::tournament_repo::TournamentRepoImpl;
use sb_table_registry::connection_broker::ConnectionBroker;
use sb_table_registry::registry::Registry;
use sb_tournament::TournamentServiceImpl;

#[derive(Debug, Deserialize)]
pub struct CreateTournamentRequest {
    pub tournament_type: String,
    pub max_players: u32,
    pub buy_in: i64,
    pub blind_schedule: Option<sb_contracts::tournament_api::BlindSchedule>,
    pub payout_structure: Option<sb_contracts::tournament_api::PayoutStructure>,
    pub start_delay_seconds: Option<u32>,
    pub min_players_to_start: Option<u32>,
}

#[derive(Debug, Serialize)]
pub struct CreateTournamentResponse {
    pub tournament_id: TournamentId,
}

#[derive(Debug, Deserialize)]
pub struct RegisterRequest {
    pub user_id: UserId,
}

#[derive(Clone)]
pub struct TournamentState {
    pub tournament_service: Arc<TournamentServiceImpl>,
    pub registry: Arc<Registry>,
    pub broker: Arc<ConnectionBroker>,
    pub tournament_repo: Arc<TournamentRepoImpl>,
    pub user_repo: Arc<dyn sb_contracts::repo_api::UserRepo>,
}

pub fn tournament_routes(state: Arc<TournamentState>) -> Router {
    Router::new()
        .route("/tournaments", post(create_tournament))
        .route("/tournaments", get(list_tournaments))
        .route("/tournaments/{tournament_id}", get(get_tournament))
        .route("/tournaments/{tournament_id}/register", post(register))
        .route("/tournaments/{tournament_id}/unregister", post(unregister))
        .route("/tournaments/{tournament_id}/results", get(get_results))
        .route("/tournaments/{tournament_id}/my-table", get(get_my_table))
        .with_state(state)
}

async fn create_tournament(
    State(state): State<Arc<TournamentState>>,
    Json(req): Json<CreateTournamentRequest>,
) -> Result<Json<CreateTournamentResponse>, (StatusCode, Json<serde_json::Value>)> {
    use sb_contracts::tournament_api::TournamentConfig;

    let config = TournamentConfig {
        club_id: None,
        scheduled_start: None,
        blind_schedule_id: None,
        tournament_type: match req.tournament_type.as_str() {
            "SitAndGo" | "sit_and_go" => sb_contracts::tournament_api::TournamentType::SitAndGo,
            "Mtt" | "mtt" => sb_contracts::tournament_api::TournamentType::Mtt,
            _ => {
                return Err((
                    StatusCode::BAD_REQUEST,
                    Json(serde_json::json!({"error": "Invalid tournament_type"})),
                ));
            }
        },
        max_players: req.max_players,
        buy_in: sb_shared_types::ChipAmount::new(req.buy_in).ok_or((
            StatusCode::BAD_REQUEST,
            Json(serde_json::json!({"error": "Invalid buy_in"})),
        ))?,
        blind_schedule: req
            .blind_schedule
            .unwrap_or(sb_contracts::tournament_api::BlindSchedule { levels: vec![] }),
        payout_structure: req
            .payout_structure
            .unwrap_or(sb_contracts::tournament_api::PayoutStructure { entries: vec![] }),
        start_delay_seconds: req.start_delay_seconds.unwrap_or(5),
        min_players_to_start: req.min_players_to_start.unwrap_or(req.max_players),
    };

    let ctx = sb_shared_types::RequestContext::new(uuid::Uuid::new_v4(), None);
    let tournament_id = state
        .tournament_service
        .create_tournament(&ctx, config)
        .await
        .map_err(|e| {
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({"error": e.to_string()})),
            )
        })?;

    Ok(Json(CreateTournamentResponse { tournament_id }))
}


#[derive(Deserialize)]
pub struct ListTournamentsQuery {
    #[serde(rename = "type")]
    pub type_filter: Option<String>,
    pub status: Option<String>,
}

async fn list_tournaments(
    State(state): State<Arc<TournamentState>>,
    Query(query): Query<ListTournamentsQuery>,
) -> Result<
    Json<Vec<sb_contracts::tournament_api::TournamentSummary>>,
    (StatusCode, Json<serde_json::Value>),
> {
    use sb_contracts::tournament_api::TournamentType;
    let type_filter = query.type_filter.and_then(|s| match s.as_str() {
        "SitAndGo" => Some(TournamentType::SitAndGo),
        "Mtt" => Some(TournamentType::Mtt),
        _ => None,
    });
    let status_filter = query.status.and_then(|s| match s.as_str() {
        "Registering" => Some(sb_contracts::tournament_api::TournamentStatus::Registering),
        "Running" => Some(sb_contracts::tournament_api::TournamentStatus::Running),
        "Completed" => Some(sb_contracts::tournament_api::TournamentStatus::Completed),
        "Cancelled" => Some(sb_contracts::tournament_api::TournamentStatus::Cancelled),
        _ => None,
    });

    let ctx = sb_shared_types::RequestContext::new(uuid::Uuid::new_v4(), None);
    let tournaments = state
        .tournament_service
        .list_tournaments(&ctx, type_filter, status_filter)
        .await
        .map_err(|e| {
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({"error": e.to_string()})),
            )
        })?;
    Ok(Json(tournaments))
}

async fn get_tournament(
    State(state): State<Arc<TournamentState>>,
    Path(tournament_id): Path<TournamentId>,
) -> Result<
    Json<sb_contracts::tournament_api::TournamentSummary>,
    (StatusCode, Json<serde_json::Value>),
> {
    let ctx = sb_shared_types::RequestContext::new(uuid::Uuid::new_v4(), None);
    let summary = state
        .tournament_service
        .get_tournament(&ctx, tournament_id)
        .await
        .map_err(|e| {
            (
                StatusCode::NOT_FOUND,
                Json(serde_json::json!({"error": e.to_string()})),
            )
        })?;
    Ok(Json(summary))
}

async fn register(
    State(state): State<Arc<TournamentState>>,
    Path(tournament_id): Path<TournamentId>,
    Json(req): Json<RegisterRequest>,
) -> Result<Json<serde_json::Value>, (StatusCode, Json<serde_json::Value>)> {
    let ctx = sb_shared_types::RequestContext::new(uuid::Uuid::new_v4(), Some(req.user_id));
    state
        .tournament_service
        .register(&ctx, tournament_id, req.user_id)
        .await
        .map_err(|e| match e {
            AppError::TournamentFull => (
                StatusCode::CONFLICT,
                Json(serde_json::json!({"error": "Tournament is full"})),
            ),
            AppError::TournamentRegistrationClosed => (
                StatusCode::BAD_REQUEST,
                Json(serde_json::json!({"error": "Registration closed"})),
            ),
            _ => (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({"error": e.to_string()})),
            ),
        })?;
    Ok(Json(serde_json::json!({"status": "registered"})))
}

async fn unregister(
    State(state): State<Arc<TournamentState>>,
    Path(tournament_id): Path<TournamentId>,
    Json(req): Json<RegisterRequest>,
) -> Result<Json<serde_json::Value>, (StatusCode, Json<serde_json::Value>)> {
    let ctx = sb_shared_types::RequestContext::new(uuid::Uuid::new_v4(), Some(req.user_id));
    state
        .tournament_service
        .unregister(&ctx, tournament_id, req.user_id)
        .await
        .map_err(|e| {
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({"error": e.to_string()})),
            )
        })?;
    Ok(Json(serde_json::json!({"status": "unregistered"})))
}

async fn get_results(
    State(state): State<Arc<TournamentState>>,
    Path(tournament_id): Path<TournamentId>,
) -> Result<
    Json<Vec<sb_contracts::tournament_api::TournamentResult>>,
    (StatusCode, Json<serde_json::Value>),
> {
    let ctx = sb_shared_types::RequestContext::new(uuid::Uuid::new_v4(), None);
    let results = state
        .tournament_service
        .get_results(&ctx, tournament_id)
        .await
        .map_err(|e| {
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({"error": e.to_string()})),
            )
        })?;
    Ok(Json(results))
}

async fn get_my_table(
    State(state): State<Arc<TournamentState>>,
    Extension(auth_user): Extension<AuthUser>,
    Path(tournament_id): Path<TournamentId>,
) -> Result<Json<serde_json::Value>, (StatusCode, Json<serde_json::Value>)> {
    let user_id = UserId::new(Uuid::parse_str(&auth_user.user_id).map_err(|_| {
        (
            StatusCode::BAD_REQUEST,
            Json(serde_json::json!({"error": "Invalid user ID"})),
        )
    })?);
    let ctx = sb_shared_types::RequestContext::new(uuid::Uuid::new_v4(), Some(user_id));

    match state
        .tournament_service
        .get_my_table(&ctx, tournament_id, user_id)
        .await
    {
        Ok(Some(table_id)) => Ok(Json(serde_json::json!({
            "table_id": table_id.to_string(),
            "status": "seated"
        }))),
        Ok(None) => Ok(Json(serde_json::json!({
            "table_id": null,
            "status": "not_seated"
        }))),
        Err(AppError::NotFound(_)) => Err((
            StatusCode::NOT_FOUND,
            Json(serde_json::json!({"error": "Tournament not found"})),
        )),
        Err(AppError::Timeout) => Err((
            StatusCode::GATEWAY_TIMEOUT,
            Json(serde_json::json!({"error": "Service timed out"})),
        )),
        Err(e) => Err((
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!({"error": e.to_string()})),
        )),
    }
}

use axum::{
    Json, Router,
    extract::{Path, State},
    http::StatusCode,
    routing::{get, post},
};
use sb_contracts::tournament_api::{TournamentConfig, TournamentType};
use sb_shared_types::{AppError, TournamentId, UserId};
use serde::{Deserialize, Serialize};
use std::sync::Arc;

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
    pub tournament_service: Arc<dyn sb_contracts::tournament_api::TournamentService>,
}

pub fn tournament_routes() -> Router<Arc<TournamentState>> {
    Router::new()
        .route("/tournaments", post(create_tournament))
        .route("/tournaments", get(list_tournaments))
        .route("/tournaments/{tournament_id}", get(get_tournament))
        .route("/tournaments/{tournament_id}/register", post(register))
        .route("/tournaments/{tournament_id}/unregister", post(unregister))
        .route("/tournaments/{tournament_id}/results", get(get_results))
}

async fn create_tournament(
    State(state): State<Arc<TournamentState>>,
    Json(req): Json<CreateTournamentRequest>,
) -> Result<Json<CreateTournamentResponse>, (StatusCode, Json<serde_json::Value>)> {
    let config = TournamentConfig {
        tournament_type: match req.tournament_type.as_str() {
            "SitAndGo" | "sit_and_go" => TournamentType::SitAndGo,
            "Mtt" | "mtt" => TournamentType::Mtt,
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

async fn list_tournaments(
    State(state): State<Arc<TournamentState>>,
) -> Result<
    Json<Vec<sb_contracts::tournament_api::TournamentSummary>>,
    (StatusCode, Json<serde_json::Value>),
> {
    let ctx = sb_shared_types::RequestContext::new(uuid::Uuid::new_v4(), None);
    let tournaments = state
        .tournament_service
        .list_tournaments(&ctx, None)
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

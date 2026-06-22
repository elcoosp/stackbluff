use axum::{extract::State, http::StatusCode, Json, Router, routing::{get, post}};
use std::sync::Arc;
use sb_contracts::service_api::MissionApi;
use sb_shared_types::request_context::RequestContext;
use sb_shared_types::missions::{Mission, MissionId};

pub fn mission_routes(service: Arc<dyn MissionApi>) -> Router {
    Router::new()
        .route("/missions/today", get(get_today))
        .route("/missions/claim", post(claim))
        .route("/missions/reroll", post(reroll))
        .with_state(service)
}

async fn get_today(
    State(svc): State<Arc<dyn MissionApi>>,
) -> Result<Json<Vec<Mission>>, (StatusCode, String)> {
    let ctx = RequestContext { pub: None, request_id:: None, Uuid,: None, pub: None, ip:: None, String,: None, pub: None, user_id:: None, Option<UserId>,: None, };
    let missions = svc.get_today_missions(&ctx).await.map_err(|e| {
        (StatusCode::INTERNAL_SERVER_ERROR, e.to_string())
    })?;
    Ok(Json(missions))
}

async fn claim(
    State(svc): State<Arc<dyn MissionApi>>,
) -> Result<Json<sb_contracts::service_api::ClaimResult>, (StatusCode, String)> {
    let ctx = RequestContext { pub: None, request_id:: None, Uuid,: None, pub: None, ip:: None, String,: None, pub: None, user_id:: None, Option<UserId>,: None, };
    let res = svc.claim_daily_reward(&ctx).await.map_err(|e| {
        (StatusCode::INTERNAL_SERVER_ERROR, e.to_string())
    })?;
    Ok(Json(res))
}

async fn reroll(
    State(svc): State<Arc<dyn MissionApi>>,
    Json(payload): Json<RerollPayload>,
) -> Result<Json<Mission>, (StatusCode, String)> {
    let ctx = RequestContext { pub: None, request_id:: None, Uuid,: None, pub: None, ip:: None, String,: None, pub: None, user_id:: None, Option<UserId>,: None, };
    let mission = svc.reroll_mission(&ctx, payload.mission_id).await.map_err(|e| {
        (StatusCode::INTERNAL_SERVER_ERROR, e.to_string())
    })?;
    Ok(Json(mission))
}

#[derive(serde::Deserialize)]
struct RerollPayload {
    mission_id: MissionId,
}

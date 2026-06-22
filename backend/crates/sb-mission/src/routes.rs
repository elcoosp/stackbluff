use axum::{extract::State, Json, Router, routing::{get, post}};
use std::sync::Arc;
use sb_contracts::service_api::MissionApi;
use sb_shared_types::request_context::RequestContext;
use sb_shared_types::errors::AppError;
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
) -> Result<Json<Vec<Mission>>, AppError> {
    let ctx = RequestContext { user_id: None }; // placeholder
    let missions = svc.get_today_missions(&ctx).await?;
    Ok(Json(missions))
}

async fn claim(
    State(svc): State<Arc<dyn MissionApi>>,
) -> Result<Json<sb_contracts::service_api::ClaimResult>, AppError> {
    let ctx = RequestContext { user_id: None };
    let res = svc.claim_daily_reward(&ctx).await?;
    Ok(Json(res))
}

async fn reroll(
    State(svc): State<Arc<dyn MissionApi>>,
    Json(payload): Json<RerollPayload>,
) -> Result<Json<Mission>, AppError> {
    let ctx = RequestContext { user_id: None };
    let mission = svc.reroll_mission(&ctx, payload.mission_id).await?;
    Ok(Json(mission))
}

#[derive(serde::Deserialize)]
struct RerollPayload {
    mission_id: MissionId,
}

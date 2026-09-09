use axum::{
    Router,
    extract::{Path, State},
    http::StatusCode,
    response::Json,
    routing::get,
};
use chrono::{DateTime, Duration, Utc};
use sea_orm::{ColumnTrait, EntityTrait, QueryFilter, Set};
use serde_json::Value;
use std::sync::Arc;
use tokio_cron_scheduler::{Job, JobScheduler};
use uuid::Uuid;

use sb_db_entities::hand_history::{ActiveModel, Column, Entity as HandHistory};

#[async_trait::async_trait]
pub trait R2Storage: Send + Sync {
    async fn put_object(&self, key: &str, data: Vec<u8>) -> Result<(), String>;
    async fn get_object(&self, key: &str) -> Result<Vec<u8>, String>;
}

pub struct RealR2 {
    client: aws_sdk_s3::Client,
    bucket: String,
}

impl RealR2 {
    pub fn new(client: aws_sdk_s3::Client, bucket: String) -> Self {
        Self { client, bucket }
    }
}

#[async_trait::async_trait]
impl R2Storage for RealR2 {
    async fn put_object(&self, key: &str, data: Vec<u8>) -> Result<(), String> {
        self.client
            .put_object()
            .bucket(&self.bucket)
            .key(key)
            .body(aws_sdk_s3::primitives::ByteStream::from(data))
            .send()
            .await
            .map(|_| ())
            .map_err(|e| e.to_string())
    }

    async fn get_object(&self, key: &str) -> Result<Vec<u8>, String> {
        let resp = self
            .client
            .get_object()
            .bucket(&self.bucket)
            .key(key)
            .send()
            .await
            .map_err(|e| e.to_string())?;
        let data = resp.body.collect().await.map_err(|e| e.to_string())?;
        Ok(data.into_bytes().to_vec())
    }
}

pub struct ArchiveState {
    pub db: sea_orm::DatabaseConnection,
    pub r2: Arc<dyn R2Storage>,
}

pub fn router(state: Arc<ArchiveState>) -> Router {
    Router::new()
        .route("/hands/{id}", get(get_hand))
        .with_state(state)
}

pub async fn start_archival_scheduler(
    state: Arc<ArchiveState>,
) -> Result<(), Box<dyn std::error::Error>> {
    let sched = JobScheduler::new().await?;
    let db = state.db.clone();
    let r2 = state.r2.clone();
    let job = Job::new_async("0 0 2 * * *", move |_uuid, _l| {
        let db = db.clone();
        let r2 = r2.clone();
        Box::pin(async move {
            if let Err(e) = run_archival(&db, &*r2).await {
                eprintln!("Archival job error: {e}");
            }
        })
    })?;
    sched.add(job).await?;
    sched.start().await?;
    Ok(())
}

pub async fn run_archival(
    db: &sea_orm::DatabaseConnection,
    r2: &dyn R2Storage,
) -> Result<(), Box<dyn std::error::Error>> {
    let cutoff = Utc::now() - Duration::days(30);
    run_archival_with_r2(db, r2, cutoff).await
}

pub async fn run_archival_with_r2(
    db: &sea_orm::DatabaseConnection,
    r2: &dyn R2Storage,
    cutoff: DateTime<Utc>,
) -> Result<(), Box<dyn std::error::Error>> {
    let hands = HandHistory::find()
        .filter(Column::PlayedAt.lt(cutoff))
        .filter(Column::IsArchived.eq(false))
        .all(db)
        .await?;

    for hand in hands {
        let json = serde_json::json!({
            "id": hand.id,
            "table_id": hand.table_id,
            "played_at": hand.played_at,
            "players": hand.players_json.seats,
            "actions": hand.actions_json.actions,
            "result": hand.result_json,
        });

        let key = format!(
            "hands/{}/{:02}/hand_{}.json",
            hand.played_at.format("%Y"),
            hand.played_at.format("%m"),
            hand.id
        );

        match r2.put_object(&key, json.to_string().into_bytes()).await {
            Ok(_) => {
                let mut active: ActiveModel = hand.clone().into();
                active.is_archived = Set(true);
                HandHistory::update(active).exec(db).await?;
            }
            Err(e) => {
                eprintln!("Failed to upload hand {}: {e}", hand.id);
            }
        }
    }
    Ok(())
}

pub async fn get_hand(
    Path(id): Path<Uuid>,
    State(state): State<Arc<ArchiveState>>,
) -> Result<Json<Value>, StatusCode> {
    if let Some(hand) = HandHistory::find_by_id(id)
        .filter(Column::IsArchived.eq(false))
        .one(&state.db)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
    {
        let json = serde_json::json!({
            "id": hand.id,
            "table_id": hand.table_id,
            "played_at": hand.played_at,
            "players": hand.players_json.seats,
            "actions": hand.actions_json.actions,
            "result": hand.result_json,
        });
        return Ok(Json(json));
    }

    let hand = HandHistory::find_by_id(id)
        .one(&state.db)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
        .ok_or(StatusCode::NOT_FOUND)?;

    let key = format!(
        "hands/{}/{:02}/hand_{}.json",
        hand.played_at.format("%Y"),
        hand.played_at.format("%m"),
        hand.id
    );

    let data = state
        .r2
        .get_object(&key)
        .await
        .map_err(|_| StatusCode::NOT_FOUND)?;
    let json_str = String::from_utf8(data).map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    let mut json: Value =
        serde_json::from_str(&json_str).map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    // Flatten the archived structure to match the frontend expectations
    if let Some(players_json) = json
        .get("players_json")
        .and_then(|v| v.get("seats").cloned())
    {
        json["players"] = players_json;
    }
    if let Some(actions_json) = json
        .get("actions_json")
        .and_then(|v| v.get("actions").cloned())
    {
        json["actions"] = actions_json;
    }
    if let Some(result_json) = json.get("result_json").cloned() {
        json["result"] = result_json;
    }
    // Remove the old nested fields to keep the response clean
    if let Some(obj) = json.as_object_mut() {
        obj.remove("players_json");
        obj.remove("actions_json");
        obj.remove("result_json");
    }

    Ok(Json(json))
}

#[allow(dead_code)]
pub async fn upload_club_banner(
    r2: &RealR2,
    club_id: sb_shared_types::ClubId,
    data: bytes::Bytes,
) -> Result<String, sb_shared_types::AppError> {
    let key = format!("club_banners/{}/banner.png", club_id);
    r2.put_object(&key, data.to_vec())
        .await
        .map_err(|e| sb_shared_types::AppError::Internal(e.to_string()))?;
    Ok(format!("https://cdn.stackbluff.com/{}", key))
}

#[allow(dead_code)]
pub struct NoOpR2;

#[async_trait::async_trait]
impl R2Storage for NoOpR2 {
    async fn put_object(&self, _key: &str, _data: Vec<u8>) -> Result<(), String> {
        Ok(())
    }

    async fn get_object(&self, _key: &str) -> Result<Vec<u8>, String> {
        Err("not found".to_string())
    }
}

use axum::{
    extract::{Path, State},
    http::StatusCode,
    routing::{get, post},
    Json, Router,
};
use base64::Engine;
use sea_orm::{ActiveModelTrait, ColumnTrait, DatabaseConnection, EntityTrait, QueryFilter, Set};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::sync::Arc;
use tokio::sync::Mutex;
use tracing::info;

use sbdc_entity::generated_prompt;
use crate::error::{Result as SbdcResult, SbdcError};

#[derive(Serialize, Clone)]
struct PromptItem {
    prompt_id: i32,
    positive: String,
    negative: String,
}

#[derive(Deserialize)]
struct ImageItem {
    index: usize,
    data: String,
}

#[derive(Deserialize)]
struct ResultPayload {
    prompt_id: i32,
    images: Vec<ImageItem>,
}

#[derive(Deserialize)]
struct StartPayload {
    _takes: Option<u32>, // unused but kept for API compatibility
}

struct AppState {
    db: DatabaseConnection,
    project_dir: PathBuf,
    prompts: Mutex<Vec<PromptItem>>,
    current_idx: Mutex<usize>,
    completed: Mutex<usize>,
    deck_id: Mutex<Option<String>>,
}

pub async fn run_server(
    db: DatabaseConnection,
    project_dir: PathBuf,
    port: u16,
) -> SbdcResult<()> {
    info!(
        "SBDC server starting on port {} (no prompts loaded yet — use popup to start)",
        port
    );

    let state = Arc::new(AppState {
        db,
        project_dir,
        prompts: Mutex::new(Vec::new()),
        current_idx: Mutex::new(0usize),
        completed: Mutex::new(0usize),
        deck_id: Mutex::new(None),
    });

    let app = Router::new()
        .route("/status", get(get_status))
        .route("/next", get(get_next))
        .route("/result", post(post_result))
        .route("/start/{deck_id}", post(start_deck))
        .with_state(state);

    let listener = tokio::net::TcpListener::bind(format!("0.0.0.0:{}", port))
        .await
        .map_err(|e| SbdcError::Io(e))?;
    info!("SBDC server listening on port {}", port);
    axum::serve(listener, app)
        .await
        .map_err(|e| SbdcError::Io(std::io::Error::new(std::io::ErrorKind::Other, e)))?;

    Ok(())
}

async fn get_status(State(state): State<Arc<AppState>>) -> Json<serde_json::Value> {
    let prompts = state.prompts.lock().await;
    let idx = state.current_idx.lock().await;
    let completed = state.completed.lock().await;
    let deck_id = state.deck_id.lock().await;
    Json(serde_json::json!({
        "total": prompts.len(),
        "current_index": *idx,
        "completed": *completed,
        "deck_id": deck_id.clone(),
        "loaded": prompts.len() > 0,
    }))
}

async fn get_next(State(state): State<Arc<AppState>>) -> Json<serde_json::Value> {
    let prompts = state.prompts.lock().await;
    let mut idx = state.current_idx.lock().await;
    if prompts.is_empty() {
        Json(serde_json::json!({"status": "waiting"}))
    } else if *idx < prompts.len() {
        let item = &prompts[*idx];
        *idx += 1;
        info!(
            "Serving prompt {}/{}: prompt_id={}",
            *idx,
            prompts.len(),
            item.prompt_id
        );
        Json(serde_json::to_value(item).unwrap())
    } else {
        info!("All {} prompts served", prompts.len());
        Json(serde_json::Value::Null)
    }
}

async fn post_result(
    State(state): State<Arc<AppState>>,
    Json(payload): Json<ResultPayload>,
) -> StatusCode {
    let deck_id_guard = state.deck_id.lock().await;
    let deck = deck_id_guard.as_deref().unwrap_or("persist");
    let output_dir = state.project_dir.join("decks").join(deck).join("0-takes");
    drop(deck_id_guard);

    tokio::fs::create_dir_all(&output_dir)
        .await
        .unwrap_or_default();

    let num_images = payload.images.len();
    for img in &payload.images {
        let suffix = if num_images > 1 {
            format!("_{}", img.index + 1)
        } else {
            String::new()
        };
        let out_path = output_dir.join(format!("prompt_{}_take{}.png", payload.prompt_id, suffix));
        let b64 = if img.data.contains(',') {
            img.data.split(',').last().unwrap_or(&img.data)
        } else {
            &img.data
        };
        match base64::engine::general_purpose::STANDARD.decode(b64) {
            Ok(bytes) => {
                if let Err(e) = tokio::fs::write(&out_path, &bytes).await {
                    tracing::error!("Failed to write {}: {}", out_path.display(), e);
                }
            }
            Err(e) => {
                tracing::error!("Base64 decode error: {}", e);
            }
        }
    }

    // Update DB — primary key is prompt_id
    if let Ok(Some(model)) = generated_prompt::Entity::find_by_id(payload.prompt_id)
        .one(&state.db)
        .await
    {
        let mut active: generated_prompt::ActiveModel = model.into();
        active.status = Set("generated".to_string());
        if let Err(e) = active.update(&state.db).await {
            tracing::error!("Failed to update prompt {}: {}", payload.prompt_id, e);
        }
    }

    let mut completed = state.completed.lock().await;
    *completed += 1;
    let total = state.prompts.lock().await.len();
    info!(
        "✅ prompt_id={} saved {} images ({}/{})",
        payload.prompt_id, num_images, *completed, total
    );

    StatusCode::OK
}

async fn start_deck(
    State(state): State<Arc<AppState>>,
    Path(deck_id): Path<String>,
    Json(_payload): Json<StartPayload>,
) -> Json<serde_json::Value> {
    info!("Loading prompts for deck: {}", deck_id);

    let prompts = generated_prompt::Entity::find()
        .filter(generated_prompt::Column::DeckId.eq(&deck_id))
        .filter(generated_prompt::Column::Status.eq("ready_to_generate"))
        .all(&state.db)
        .await
        .unwrap_or_default();

    let prompt_items: Vec<PromptItem> = prompts
        .iter()
        .map(|p| PromptItem {
            prompt_id: p.prompt_id,
            positive: p.final_positive.clone(),
            negative: p.final_negative.clone(),
        })
        .collect();

    let count = prompt_items.len();
    *state.prompts.lock().await = prompt_items;
    *state.current_idx.lock().await = 0;
    *state.completed.lock().await = 0;
    *state.deck_id.lock().await = Some(deck_id.clone());

    info!("✅ Loaded {} prompts for deck {}", count, deck_id);

    Json(serde_json::json!({
        "total": count,
        "prompt_count": count,
        "deck_id": deck_id,
    }))
}

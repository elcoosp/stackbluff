use axum::{
    extract::{Path, State},
    http::StatusCode,
    routing::{get, post},
    Json, Router,
};
use base64::Engine;
use sea_orm::{
    ActiveModelTrait, ColumnTrait, DatabaseConnection, EntityTrait, NotSet, PaginatorTrait,
    QueryFilter, Set, TransactionTrait,
};
use serde::Deserialize;
use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::Arc;
use tokio::sync::Mutex;
use tower_http::cors::{Any, CorsLayer};
use tracing::info;

use sbdc_entity::{deck, generated_prompt, prompt_take};
use crate::error::{Result as SbdcResult, SbdcError};

#[derive(Deserialize)]
pub struct StartRequest {
    pub takes_per_prompt: Option<u32>,
}

#[derive(Deserialize)]
pub struct SubmitTakesRequest {
    pub images: Vec<ImageData>,
}

#[derive(Deserialize)]
pub struct ImageData {
    pub index: usize,
    pub data: String,
}

pub struct AppState {
    pub db: DatabaseConnection,
    pub project_dir: PathBuf,
    pub takes_target: Mutex<HashMap<String, u32>>,
}

async fn count_prompts(
    db: &DatabaseConnection,
    deck_id: &str,
    status: Option<&str>,
) -> Result<u64, (StatusCode, String)> {
    let mut q = generated_prompt::Entity::find()
        .filter(generated_prompt::Column::DeckId.eq(deck_id));
    if let Some(s) = status {
        q = q.filter(generated_prompt::Column::Status.eq(s));
    }
    q.count(db)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))
}

pub async fn start_deck(
    State(state): State<Arc<AppState>>,
    Path(deck_id): Path<String>,
    Json(payload): Json<StartRequest>,
) -> Result<Json<serde_json::Value>, (StatusCode, String)> {
    let deck_model = deck::Entity::find_by_id(&deck_id)
        .one(&state.db)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
        .ok_or_else(|| {
            (StatusCode::NOT_FOUND, format!("Deck '{}' not found", deck_id))
        })?;

    let takes = payload.takes_per_prompt.unwrap_or(4);
    state
        .takes_target
        .lock()
        .await
        .insert(deck_id.clone(), takes);

    let mut active: deck::ActiveModel = deck_model.into();
    active.status = Set("generating".to_string());
    active
        .update(&state.db)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let ready_count = count_prompts(&state.db, &deck_id, Some("ready_to_generate")).await?;

    info!(
        "Started deck '{}' with {} takes/prompt, {} prompts ready",
        deck_id, takes, ready_count
    );

    Ok(Json(serde_json::json!({
        "deck_id": deck_id,
        "takes_per_prompt": takes,
        "prompts_ready": ready_count,
    })))
}

pub async fn deck_status(
    State(state): State<Arc<AppState>>,
    Path(deck_id): Path<String>,
) -> Result<Json<serde_json::Value>, (StatusCode, String)> {
    let deck_model = deck::Entity::find_by_id(&deck_id)
        .one(&state.db)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
        .ok_or_else(|| {
            (StatusCode::NOT_FOUND, format!("Deck '{}' not found", deck_id))
        })?;

    let total = count_prompts(&state.db, &deck_id, None).await?;
    let ready = count_prompts(&state.db, &deck_id, Some("ready_to_generate")).await?;
    let generating = count_prompts(&state.db, &deck_id, Some("generating")).await?;
    let takes_ready = count_prompts(&state.db, &deck_id, Some("takes_ready")).await?;
    let cleaned = count_prompts(&state.db, &deck_id, Some("cleaned")).await?;
    let takes_target = state
        .takes_target
        .lock()
        .await
        .get(&deck_id)
        .copied()
        .unwrap_or(0);

    Ok(Json(serde_json::json!({
        "deck_id": deck_id,
        "status": deck_model.status,
        "total_prompts": total,
        "ready_to_generate": ready,
        "generating": generating,
        "takes_ready": takes_ready,
        "cleaned": cleaned,
        "takes_per_prompt": takes_target,
    })))
}

pub async fn next_prompt(
    State(state): State<Arc<AppState>>,
    Path(deck_id): Path<String>,
) -> Result<Json<serde_json::Value>, (StatusCode, String)> {
    let txn = state
        .db
        .begin()
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let prompt = generated_prompt::Entity::find()
        .filter(generated_prompt::Column::DeckId.eq(&deck_id))
        .filter(generated_prompt::Column::Status.eq("ready_to_generate"))
        .one(&txn)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let prompt = match prompt {
        Some(p) => p,
        None => {
            return Ok(Json(serde_json::json!({"status": "no_more_prompts"})));
        }
    };

    let mut active: generated_prompt::ActiveModel = prompt.clone().into();
    active.status = Set("generating".to_string());
    active
        .update(&txn)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    txn.commit()
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    info!(
        "Serving prompt {} ({}/{}) for deck {}",
        prompt.prompt_id, prompt.target_card, prompt.target_layer, deck_id
    );

    Ok(Json(serde_json::json!({
        "prompt_id": prompt.prompt_id,
        "target_card": prompt.target_card,
        "target_layer": prompt.target_layer,
        "positive": prompt.final_positive,
        "negative": prompt.final_negative,
    })))
}

pub async fn submit_takes(
    State(state): State<Arc<AppState>>,
    Path((deck_id, prompt_id)): Path<(String, i32)>,
    Json(payload): Json<SubmitTakesRequest>,
) -> Result<Json<serde_json::Value>, (StatusCode, String)> {
    let prompt = generated_prompt::Entity::find_by_id(prompt_id)
        .one(&state.db)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
        .ok_or_else(|| {
            (StatusCode::NOT_FOUND, format!("Prompt {} not found", prompt_id))
        })?;

    if prompt.deck_id != deck_id {
        return Err((
            StatusCode::BAD_REQUEST,
            "Prompt does not belong to deck".into(),
        ));
    }

    let deck_model = deck::Entity::find_by_id(&deck_id)
        .one(&state.db)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
        .ok_or_else(|| {
            (StatusCode::NOT_FOUND, format!("Deck '{}' not found", deck_id))
        })?;

    let takes_dir = state
        .project_dir
        .join("decks")
        .join(&deck_model.season_id)
        .join(&deck_id)
        .join("0-takes")
        .join(&prompt.target_card);

    tokio::fs::create_dir_all(&takes_dir)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let mut take_ids = Vec::new();

    for img in &payload.images {
        let filename = format!("take_{}.png", img.index + 1);
        let file_path = takes_dir.join(&filename);

        let b64 = if img.data.contains(',') {
            img.data.split(',').last().unwrap_or(&img.data)
        } else {
            &img.data
        };
        let bytes = base64::engine::general_purpose::STANDARD
            .decode(b64)
            .map_err(|e| (StatusCode::BAD_REQUEST, format!("Base64 decode error: {}", e)))?;

        tokio::fs::write(&file_path, &bytes)
            .await
            .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

        let take = prompt_take::ActiveModel {
            take_id: NotSet,
            prompt_id: Set(prompt_id),
            file_path: Set(file_path.to_str().unwrap_or("").to_string()),
            is_selected: Set(false),
        };
        let inserted = take
            .insert(&state.db)
            .await
            .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
        take_ids.push(inserted.take_id);
    }

    let mut active: generated_prompt::ActiveModel = prompt.into();
    active.status = Set("takes_ready".to_string());
    active
        .update(&state.db)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    info!(
        "Saved {} takes for prompt {} in deck {}",
        payload.images.len(),
        prompt_id,
        deck_id
    );

    Ok(Json(serde_json::json!({
        "take_ids": take_ids,
        "count": take_ids.len(),
    })))
}

pub async fn list_takes(
    State(state): State<Arc<AppState>>,
    Path(deck_id): Path<String>,
) -> Result<Json<serde_json::Value>, (StatusCode, String)> {
    let prompts = generated_prompt::Entity::find()
        .filter(generated_prompt::Column::DeckId.eq(&deck_id))
        .all(&state.db)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let mut result = Vec::new();
    for prompt in &prompts {
        let takes = prompt_take::Entity::find()
            .filter(prompt_take::Column::PromptId.eq(prompt.prompt_id))
            .all(&state.db)
            .await
            .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

        for take in takes {
            result.push(serde_json::json!({
                "take_id": take.take_id,
                "prompt_id": take.prompt_id,
                "target_card": prompt.target_card,
                "target_layer": prompt.target_layer,
                "target_file": prompt.target_file,
                "file_path": take.file_path,
                "selected": take.is_selected,
            }));
        }
    }

    Ok(Json(serde_json::json!({"takes": result})))
}

pub async fn select_take(
    State(state): State<Arc<AppState>>,
    Path((deck_id, take_id)): Path<(String, i32)>,
) -> Result<Json<serde_json::Value>, (StatusCode, String)> {
    let take = prompt_take::Entity::find_by_id(take_id)
        .one(&state.db)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
        .ok_or_else(|| {
            (StatusCode::NOT_FOUND, format!("Take {} not found", take_id))
        })?;

    let prompt = generated_prompt::Entity::find_by_id(take.prompt_id)
        .one(&state.db)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
        .ok_or_else(|| (StatusCode::NOT_FOUND, "Prompt not found".into()))?;

    if prompt.deck_id != deck_id {
        return Err((
            StatusCode::BAD_REQUEST,
            "Take does not belong to deck".into(),
        ));
    }

    let all_takes = prompt_take::Entity::find()
        .filter(prompt_take::Column::PromptId.eq(take.prompt_id))
        .all(&state.db)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    for t in all_takes {
        let mut active: prompt_take::ActiveModel = t.into();
        active.is_selected = Set(false);
        active
            .update(&state.db)
            .await
            .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
    }

    let take = prompt_take::Entity::find_by_id(take_id)
        .one(&state.db)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
        .unwrap();

    let mut active: prompt_take::ActiveModel = take.into();
    active.is_selected = Set(true);
    active
        .update(&state.db)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    info!(
        "Selected take {} for prompt {} in deck {}",
        take_id, prompt.prompt_id, deck_id
    );

    Ok(Json(serde_json::json!({"selected": take_id})))
}

pub async fn run_server(
    db: DatabaseConnection,
    project_dir: PathBuf,
    port: u16,
) -> SbdcResult<()> {
    info!("SBDC server starting on port {}", port);

    let state = Arc::new(AppState {
        db,
        project_dir,
        takes_target: Mutex::new(HashMap::new()),
    });

    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    let app = Router::new()
        .route("/api/decks/{deck_id}/start", post(start_deck))
        .route("/api/decks/{deck_id}/status", get(deck_status))
        .route("/api/decks/{deck_id}/prompts/next", get(next_prompt))
        .route(
            "/api/decks/{deck_id}/prompts/{prompt_id}/takes",
            post(submit_takes),
        )
        .route("/api/decks/{deck_id}/takes", get(list_takes))
        .route(
            "/api/decks/{deck_id}/takes/{take_id}/select",
            post(select_take),
        )
        .layer(cors)
        .with_state(state);

    let listener = tokio::net::TcpListener::bind(format!("0.0.0.0:{}", port))
        .await
        .map_err(SbdcError::Io)?;
    info!("SBDC server listening on port {}", port);
    axum::serve(listener, app)
        .await
        .map_err(|e| SbdcError::Io(std::io::Error::new(std::io::ErrorKind::Other, e)))?;

    Ok(())
}

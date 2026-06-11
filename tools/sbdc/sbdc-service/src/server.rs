use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::IntoResponse,
    routing::{get, post},
    Json, Router,
};
use base64::{engine::general_purpose::STANDARD as BASE64, Engine};
use sbdc_entity::{generated_prompt, prompt_take};
use sea_orm::{ActiveModelTrait, ColumnTrait, EntityTrait, QueryFilter, Set};
use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::Arc;
use tokio::sync::Mutex;
use tower_http::cors::{Any, CorsLayer};

use crate::error::Result;

#[derive(Clone)]
struct GenSession {
    deck_id: String,
    takes: u32,
    current_take: u32,
    current_prompt_index: usize,
    prompts: Vec<generated_prompt::Model>,
}

struct AppState {
    db: sea_orm::DatabaseConnection,
    project_dir: PathBuf,
    sessions: Arc<Mutex<HashMap<String, GenSession>>>,
}

async fn start_generation(
    State(state): State<Arc<AppState>>,
    Path(deck_id): Path<String>,
    Json(params): Json<serde_json::Value>,
) -> impl IntoResponse {
    let takes = params.get("takes").and_then(|v| v.as_u64()).unwrap_or(4) as u32;
    let prompts = generated_prompt::Entity::find()
        .filter(generated_prompt::Column::DeckId.eq(&deck_id))
        .filter(generated_prompt::Column::Status.eq("ready_to_generate"))
        .all(&state.db)
        .await
        .unwrap_or_default();

    if prompts.is_empty() {
        return (StatusCode::BAD_REQUEST, "No ready prompts").into_response();
    }

    let session_id = uuid::Uuid::new_v4().to_string();
    let session = GenSession {
        deck_id,
        takes,
        current_take: 0,
        current_prompt_index: 0,
        prompts,
    };

    state.sessions.lock().await.insert(session_id.clone(), session);
    (StatusCode::OK, Json(serde_json::json!({ "session_id": session_id }))).into_response()
}

async fn next_prompt(
    State(state): State<Arc<AppState>>,
    Path(session_id): Path<String>,
) -> impl IntoResponse {
    let mut sessions = state.sessions.lock().await;
    let session = match sessions.get_mut(&session_id) {
        Some(s) => s,
        None => return (StatusCode::NOT_FOUND, "Session not found").into_response(),
    };

    if session.current_take >= session.takes {
        sessions.remove(&session_id);
        return (StatusCode::OK, Json(serde_json::json!({ "status": "DONE" }))).into_response();
    }

    if session.current_prompt_index >= session.prompts.len() {
        session.current_take += 1;
        session.current_prompt_index = 0;
        if session.current_take >= session.takes {
            sessions.remove(&session_id);
            return (StatusCode::OK, Json(serde_json::json!({ "status": "DONE" }))).into_response();
        }
    }

    let prompt = &session.prompts[session.current_prompt_index];
    let resp = serde_json::json!({
        "status": "PROMPT",
        "take": session.current_take + 1,
        "prompt_id": prompt.prompt_id,
        "positive": prompt.final_positive,
        "negative": prompt.final_negative,
        "shape": if prompt.target_variant == "full" { "2:3" } else { "1:1" },
    });
    (StatusCode::OK, Json(resp)).into_response()
}

async fn submit_result(
    State(state): State<Arc<AppState>>,
    Path(session_id): Path<String>,
    Json(payload): Json<serde_json::Value>,
) -> impl IntoResponse {
    let prompt_id = payload["prompt_id"].as_u64().unwrap_or(0) as i32;
    let default_vec = Vec::new();
    let images = payload["images"].as_array().unwrap_or(&default_vec);
    let take = payload["take"].as_u64().unwrap_or(1) as u32;

    let mut sessions = state.sessions.lock().await;
    let session = match sessions.get_mut(&session_id) {
        Some(s) => s,
        None => return (StatusCode::NOT_FOUND, "Session not found").into_response(),
    };

    // Get the actual season_id for this deck
    use sbdc_entity::deck;
    let deck_record = deck::Entity::find()
        .filter(deck::Column::DeckId.eq(&session.deck_id))
        .one(&state.db)
        .await
        .unwrap_or(None);
    let season_id = deck_record.map(|d| d.season_id).unwrap_or_else(|| "default_season".to_string());
    let deck_dir = state
        .project_dir
        .join("decks")
        .join(season_id)
        .join(&session.deck_id)
        .join("0-takes");
    tokio::fs::create_dir_all(&deck_dir).await.unwrap();

    for (idx, img) in images.iter().enumerate() {
        let b64_data = img["data"].as_str().unwrap_or("");
        let data = BASE64.decode(b64_data.split(',').last().unwrap_or("")).unwrap();
        let filename = format!(
            "prompt_{}_take{}_{}.png",
            prompt_id,
            take,
            if images.len() > 1 { idx + 1 } else { 1 }
        );
        let path = deck_dir.join(filename);
        tokio::fs::write(&path, data).await.unwrap();

        prompt_take::ActiveModel {
            take_id: sea_orm::NotSet,
            prompt_id: Set(prompt_id),
            file_path: Set(path.to_string_lossy().to_string()),
            is_selected: Set(false),
        }
        .insert(&state.db)
        .await
        .unwrap();
    }

    session.current_prompt_index += 1;
    (StatusCode::OK, "OK").into_response()
}

pub async fn run_server(db: sea_orm::DatabaseConnection, project_dir: PathBuf, port: u16) -> Result<()> {
    let state = Arc::new(AppState {
        db,
        project_dir,
        sessions: Arc::new(Mutex::new(HashMap::new())),
    });

    let app = Router::new()
        .route("/start/:deck_id", post(start_generation))
        .route("/next/:session_id", get(next_prompt))
        .route("/result/:session_id", post(submit_result))
        .layer(
            CorsLayer::new()
                .allow_origin(Any)
                .allow_methods(Any)
                .allow_headers(Any),
        )
        .with_state(state);

    let listener = tokio::net::TcpListener::bind(format!("0.0.0.0:{}", port)).await?;
    tracing::info!("HTTP server running on port {}", port);
    axum::serve(listener, app).await?;
    Ok(())
}

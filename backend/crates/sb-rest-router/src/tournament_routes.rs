use axum::{
    Json, Router,
    http::StatusCode,
    routing::{get, post},
};

pub fn tournament_routes() -> Router {
    Router::new()
        .route("/tournaments", post(create_tournament))
        .route("/tournaments", get(list_tournaments))
        .route("/tournaments/{tournament_id}", get(get_tournament))
        .route("/tournaments/{tournament_id}/register", post(register))
        .route("/tournaments/{tournament_id}/unregister", post(unregister))
        .route("/tournaments/{tournament_id}/results", get(get_results))
}

async fn create_tournament() -> (StatusCode, Json<serde_json::Value>) {
    (
        StatusCode::NOT_IMPLEMENTED,
        Json(serde_json::json!({"error": "not implemented"})),
    )
}

async fn list_tournaments() -> (StatusCode, Json<serde_json::Value>) {
    (
        StatusCode::NOT_IMPLEMENTED,
        Json(serde_json::json!({"error": "not implemented"})),
    )
}

async fn get_tournament() -> (StatusCode, Json<serde_json::Value>) {
    (
        StatusCode::NOT_IMPLEMENTED,
        Json(serde_json::json!({"error": "not implemented"})),
    )
}

async fn register() -> (StatusCode, Json<serde_json::Value>) {
    (
        StatusCode::NOT_IMPLEMENTED,
        Json(serde_json::json!({"error": "not implemented"})),
    )
}

async fn unregister() -> (StatusCode, Json<serde_json::Value>) {
    (
        StatusCode::NOT_IMPLEMENTED,
        Json(serde_json::json!({"error": "not implemented"})),
    )
}

async fn get_results() -> (StatusCode, Json<serde_json::Value>) {
    (
        StatusCode::NOT_IMPLEMENTED,
        Json(serde_json::json!({"error": "not implemented"})),
    )
}

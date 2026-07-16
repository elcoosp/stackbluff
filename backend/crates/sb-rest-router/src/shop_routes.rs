use axum::{
    Extension, Json, Router,
    extract::State,
    http::StatusCode,
    routing::{get, post},
};
use sb_auth::middleware::AuthUser;
use serde::Serialize;
use std::sync::Arc;

use crate::{AppState, ErrorResponse, bad_request, internal_error};

#[derive(Serialize)]
pub struct ProductResponse {
    pub id: uuid::Uuid,
    pub name: String,
    pub description: String,
    pub price_eur: f64,
    pub price_stars: u64,
    pub product_type: String,
    pub chips_amount: u64,
    pub duration_days: u64,
}

#[derive(serde::Deserialize)]
pub struct PurchaseRequest {
    pub product_id: uuid::Uuid,
    pub provider: Option<String>, // defaults to "stripe"
}

pub fn shop_routes() -> Router<Arc<AppState>> {
    Router::new()
        .route("/shop/products", get(get_products))
        .route("/shop/purchase", post(purchase_product))
}

async fn get_products(
    State(state): State<Arc<AppState>>,
) -> Result<Json<Vec<ProductResponse>>, (StatusCode, Json<ErrorResponse>)> {
    let products = state
        .product_repo
        .list_products()
        .await
        .map_err(internal_error)?;

    let response: Vec<ProductResponse> = products
        .into_iter()
        .map(|p| ProductResponse {
            id: p.id,
            name: p.name,
            description: p.description,
            price_eur: p.price_eur,
            price_stars: p.price_stars,
            product_type: p.product_type,
            chips_amount: p.chips_amount,
            duration_days: p.duration_days,
        })
        .collect();

    Ok(Json(response))
}

#[axum::debug_handler]
async fn purchase_product(
    Extension(auth_user): Extension<AuthUser>,
    State(state): State<Arc<AppState>>,
    Json(req): Json<PurchaseRequest>,
) -> Result<Json<serde_json::Value>, (StatusCode, Json<ErrorResponse>)> {
    let user_id = sb_shared_types::UserId::new(
        uuid::Uuid::parse_str(&auth_user.user_id)
            .map_err(|_| bad_request("INVALID_USER", "Invalid user ID"))?,
    );

    let provider = req.provider.unwrap_or_else(|| "stripe".to_string());

    let result = state
        .payment_service
        .create_product_purchase(user_id, req.product_id, provider, serde_json::json!({}))
        .await
        .map_err(internal_error)?;

    let json_result: serde_json::Value =
        serde_json::from_str(&result).map_err(internal_error)?;

    Ok(Json(json_result))
}

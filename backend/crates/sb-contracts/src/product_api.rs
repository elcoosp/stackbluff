use crate::persistence_error::PersistenceError;
use async_trait::async_trait;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Product {
    pub id: Uuid,
    pub name: String,
    pub description: String,
    pub price_eur: f64,
    pub price_stars: u64,
    pub product_type: String,
    pub chips_amount: u64,
    pub duration_days: u64,
}

#[async_trait]
pub trait ProductRepo: Send + Sync {
    async fn list_products(&self) -> Result<Vec<Product>, PersistenceError>;
}

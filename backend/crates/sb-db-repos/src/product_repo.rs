use async_trait::async_trait;
use sb_contracts::product_api::{Product, ProductRepo};
use sb_contracts::repo_api::PersistenceError;
use sb_db_entities::products;
use sea_orm::{DatabaseConnection, EntityTrait};
use uuid::Uuid;

pub struct ProductRepoImpl {
    db: DatabaseConnection,
}

impl ProductRepoImpl {
    pub fn new(db: DatabaseConnection) -> Self {
        Self { db }
    }
}

#[async_trait]
impl ProductRepo for ProductRepoImpl {
    async fn list_products(&self) -> Result<Vec<Product>, PersistenceError> {
        let models = products::Entity::find()
            .all(&self.db)
            .await
            .map_err(|e| PersistenceError::Database(e.to_string()))?;

        let products: Result<Vec<Product>, PersistenceError> = models
            .into_iter()
            .map(|m| {
                let id = Uuid::parse_str(&m.id)
                    .map_err(|_| PersistenceError::Database("Invalid UUID".into()))?;
                Ok(Product {
                    id,
                    name: m.name,
                    description: m.description,
                    price_eur: m.price as f64 / 100.0,
                    price_stars: m.stars_price as u64,
                    product_type: m.product_type,
                    chips_amount: m
                        .metadata
                        .get("chips")
                        .and_then(|v| v.as_u64())
                        .unwrap_or(0),
                    duration_days: m
                        .metadata
                        .get("duration_days")
                        .and_then(|v| v.as_u64())
                        .unwrap_or(0),
                })
            })
            .collect();

        Ok(products?)
    }
}

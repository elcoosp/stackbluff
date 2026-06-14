use async_trait::async_trait;
use dashmap::DashMap;
use sb_contracts::service_api::UserService;
use sb_shared_types::{AppError, ChipAmount, UserId};
use sea_orm::DatabaseConnection;
use std::hash::{Hash, Hasher};
use std::sync::Arc;

fn user_id_to_u64(user_id: &UserId) -> u64 {
    let mut hasher = std::collections::hash_map::DefaultHasher::new();
    user_id.hash(&mut hasher);
    hasher.finish()
}

pub struct AuthService {
    _db: DatabaseConnection,
    order_cache: Arc<DashMap<UserId, u64>>,
}

impl AuthService {
    pub fn new(db: DatabaseConnection) -> Self {
        Self {
            _db: db,
            order_cache: Arc::new(DashMap::new()),
        }
    }
}

#[async_trait]
impl UserService for AuthService {
    async fn award_chips(&self, _user_id: UserId, _amount: ChipAmount) -> Result<(), AppError> {
        Ok(())
    }
    async fn get_user_name(&self, _user_id: UserId) -> Result<String, AppError> {
        Ok("Player".to_string())
    }
    async fn get_registration_order(&self, user_id: UserId) -> Result<Option<u64>, AppError> {
        if let Some(order) = self.order_cache.get(&user_id) {
            return Ok(Some(*order));
        }
        let order = Some(user_id_to_u64(&user_id) % 10000 + 1);
        if let Some(o) = order {
            self.order_cache.insert(user_id, o);
        }
        Ok(order)
    }
}

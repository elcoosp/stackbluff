pub mod routes;
pub mod service;
pub mod entities;

use std::sync::Arc;
use axum::Router;
use sea_orm::DatabaseConnection;
use sb_contracts::service_api::UserService;

pub fn mission_routes(
    db: Arc<DatabaseConnection>,
    user_service: Arc<dyn UserService>,
) -> Router {
    let service = Arc::new(service::MissionServiceImpl::new(db, user_service));
    routes::mission_routes(service)
}

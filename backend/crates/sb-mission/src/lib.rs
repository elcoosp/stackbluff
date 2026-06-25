pub mod entities;
pub mod routes;
pub mod service;

use axum::Router;
use sb_contracts::service_api::UserService;
use sea_orm::DatabaseConnection;
use std::sync::Arc;

pub fn mission_routes(db: Arc<DatabaseConnection>, user_service: Arc<dyn UserService>) -> Router {
    let service = Arc::new(service::MissionServiceImpl::new(db, user_service));
    routes::mission_routes(service)
}

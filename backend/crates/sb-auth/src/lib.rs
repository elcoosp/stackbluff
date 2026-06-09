pub mod auth_service;
pub mod config;
pub mod jwt;
pub mod error;
pub mod routes;

use std::sync::Arc;

pub use auth_service::AuthServiceImpl;
pub use config::AuthConfig;
pub use routes::auth_router;

pub type SharedAuthService = Arc<dyn sb_contracts::service_api::AuthService>;

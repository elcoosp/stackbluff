pub mod auth_service;
pub mod email;
pub mod email_queue;
use sb_contracts::service_api::AuthService;
pub mod config;
pub mod error;
pub mod jwt;
pub mod middleware;
pub mod routes;

// Re-export the main authentication service and the missing Authenticator trait.
pub use auth_service::AuthServiceImpl;
pub use auth_service::Authenticator; // we'll add this trait in auth_service.rs

pub type SharedAuthService = std::sync::Arc<dyn AuthService + Send + Sync>;

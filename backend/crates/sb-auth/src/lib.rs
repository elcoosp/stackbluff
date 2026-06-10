pub mod auth_service;
pub mod config;
pub mod jwt;
pub mod routes;

use std::sync::Arc;

pub use auth_service::AuthServiceImpl;
pub use config::AuthConfig;
pub use routes::auth_router;

pub type SharedAuthService = Arc<dyn sb_contracts::service_api::AuthService>;
// Stub for #005 – replace with real JWT validation from #004
use sb_shared_types::UserId;
pub fn validate_token(_token: &str) -> Result<UserId, &'static str> {
    Ok(UserId::new())
}
// Stub for #005 – replace with real JWT validation from #004
use sb_shared_types::UserId;
pub fn validate_token(_token: &str) -> Result<UserId, &'static str> {
    Ok(UserId::new())
}

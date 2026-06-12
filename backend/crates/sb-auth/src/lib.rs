use async_trait::async_trait;
use sb_shared_types::UserId;

#[async_trait]
pub trait Authenticator: Send + Sync {
    async fn validate_token(&self, token: &str) -> Result<UserId, &'static str>;
}

pub struct NoopAuthenticator;

#[async_trait]
impl Authenticator for NoopAuthenticator {
    async fn validate_token(&self, _token: &str) -> Result<UserId, &'static str> {
        tracing::warn!("Using NoopAuthenticator – insecure stub");
        Ok(UserId(uuid::Uuid::new_v4()))
    }
}
pub mod middleware;
pub use middleware::{AuthUser, auth_middleware};

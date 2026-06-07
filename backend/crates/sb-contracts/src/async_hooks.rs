use async_trait::async_trait;
use sb_shared_types::{UserId, RequestContext};

#[async_trait]
pub trait NotificationHook: Send + Sync {
    async fn notify_user(&self, user_id: UserId, message: &str, ctx: &RequestContext) -> Result<(), String>;
}

#[async_trait]
pub trait ViralHook: Send + Sync {
    async fn on_referral_used(&self, referrer: UserId, new_user: UserId, ctx: &RequestContext) -> Result<(), String>;
}

#[async_trait]
pub trait AuditHook: Send + Sync {
    async fn log_action(&self, user_id: UserId, action: &str, ctx: &RequestContext) -> Result<(), String>;
}

use sb_contracts::service_api::TableService;
use sb_contracts::notification_api::NotificationService;
use sb_contracts::user_resolution::UserResolutionService;
use std::sync::Arc;

#[derive(Clone)]
pub struct BotState {
    pub table_service: Arc<dyn TableService + Send + Sync>,
    pub notification_service: Arc<dyn NotificationService + Send + Sync>,
    pub user_resolution: Arc<dyn UserResolutionService + Send + Sync>,
    pub bot_token: String,
    pub mini_app_url: String,
}

impl BotState {
    pub fn new(
        table_service: Arc<dyn TableService + Send + Sync>,
        notification_service: Arc<dyn NotificationService + Send + Sync>,
        user_resolution: Arc<dyn UserResolutionService + Send + Sync>,
        bot_token: String,
        mini_app_url: String,
    ) -> Self {
        Self {
            table_service,
            notification_service,
            user_resolution,
            bot_token,
            mini_app_url,
        }
    }
}

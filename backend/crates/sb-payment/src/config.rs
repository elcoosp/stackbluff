use sb_shared_types::AppError;

#[derive(Clone)]
pub struct PaymentConfig {
    pub stripe_success_url: String,
    pub stripe_cancel_url: String,
    pub telegram_bot_token: String,
    // P-2 FIX: the static secret token Telegram sends on every webhook
    // (set via `setWebhook`). Used to authenticate the incoming update.
    pub telegram_webhook_secret: String,
}

impl PaymentConfig {
    pub fn from_env() -> Result<Self, AppError> {
        let stripe_success_url = std::env::var("STRIPE_SUCCESS_URL")
            .map_err(|_| AppError::Configuration("STRIPE_SUCCESS_URL not set".into()))?;
        let stripe_cancel_url = std::env::var("STRIPE_CANCEL_URL")
            .map_err(|_| AppError::Configuration("STRIPE_CANCEL_URL not set".into()))?;
        let telegram_bot_token = std::env::var("TELEGRAM_BOT_TOKEN")
            .map_err(|_| AppError::Configuration("TELEGRAM_BOT_TOKEN not set".into()))?;
        let telegram_webhook_secret = std::env::var("TELEGRAM_WEBHOOK_SECRET")
            .unwrap_or_default();
        Ok(Self {
            stripe_success_url,
            stripe_cancel_url,
            telegram_bot_token,
            telegram_webhook_secret,
        })
    }
}

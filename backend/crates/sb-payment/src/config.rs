use sb_shared_types::AppError;

#[derive(Clone)]
pub struct PaymentConfig {
    pub stripe_success_url: String,
    pub stripe_cancel_url: String,
    pub telegram_bot_token: String,
}

impl PaymentConfig {
    pub fn from_env() -> Result<Self, AppError> {
        let stripe_success_url = std::env::var("STRIPE_SUCCESS_URL")
            .map_err(|_| AppError::Configuration("STRIPE_SUCCESS_URL not set".into()))?;
        let stripe_cancel_url = std::env::var("STRIPE_CANCEL_URL")
            .map_err(|_| AppError::Configuration("STRIPE_CANCEL_URL not set".into()))?;
        let telegram_bot_token = std::env::var("TELEGRAM_BOT_TOKEN")
            .map_err(|_| AppError::Configuration("TELEGRAM_BOT_TOKEN not set".into()))?;
        Ok(Self {
            stripe_success_url,
            stripe_cancel_url,
            telegram_bot_token,
        })
    }
}

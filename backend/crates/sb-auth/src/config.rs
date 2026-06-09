use argon2::{Argon2, Params, Version};

pub const ARGON2_PARAMS: Params = Params::new(
    65536,    // memory (KB)
    2,        // iterations
    1,        // parallelism
    None,
).unwrap();

pub fn argon2_instance() -> Argon2<'static> {
    Argon2::new(argon2::Algorithm::Argon2id, Version::V0x13, ARGON2_PARAMS)
}

#[derive(Clone, Debug)]
pub struct AuthConfig {
    pub jwt_secret: String,
    pub bot_token: String,
    pub jwt_expiry_days: i64,
}

impl AuthConfig {
    pub fn from_env() -> Self {
        Self {
            jwt_secret: std::env::var("JWT_SECRET").unwrap_or_else(|_| "change-me".into()),
            bot_token: std::env::var("TELEGRAM_BOT_TOKEN").unwrap_or_else(|_| "".into()),
            jwt_expiry_days: std::env::var("JWT_EXPIRY_DAYS")
                .ok()
                .and_then(|d| d.parse().ok())
                .unwrap_or(30),
        }
    }
}

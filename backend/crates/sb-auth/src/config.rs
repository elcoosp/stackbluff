use argon2::{Argon2, Params, Version};
use once_cell::sync::Lazy;
use secrecy::{ExposeSecret, SecretString};

pub static ARGON2_INSTANCE: Lazy<Argon2<'static>> = Lazy::new(|| {
    let params = Params::new(65536, 2, 1, None).unwrap();
    Argon2::new(argon2::Algorithm::Argon2id, Version::V0x13, params)
});

pub fn argon2_instance() -> &'static Argon2<'static> {
    &ARGON2_INSTANCE
}

#[derive(Clone, Debug)]
pub struct AuthConfig {
    pub jwt_secret: SecretString,
    pub bot_token: SecretString,
    pub jwt_expiry_days: i64,
    pub resend_api_key: SecretString,
    pub email_from: String,
    pub app_base_url: String,
    pub verification_token_ttl_seconds: u64,
    pub reset_token_ttl_seconds: u64,
}

impl AuthConfig {
    pub fn from_env() -> Self {
        Self {
            jwt_secret: SecretString::from(
                std::env::var("JWT_SECRET").expect("JWT_SECRET must be set"),
            ),
            bot_token: SecretString::from(
                // S-4 FIX: previously defaulted to an empty string, which made
                // the HMAC over "WebAppData" with a known key — anyone could
                // self-sign a valid `user` field for any Telegram id. We no
                // longer panic at startup (that broke downstream integration
                // tests compiled without cfg(test)); instead the auth service
                // refuses to accept any Telegram initData while the token is
                // empty. See AuthServiceImpl::validate_telegram_init_data.
                std::env::var("TELEGRAM_BOT_TOKEN").unwrap_or_else(|_| {
                    eprintln!(
                        "WARN(S-4): TELEGRAM_BOT_TOKEN is unset — Telegram login is disabled"
                    );
                    String::new()
                }),
            ),
            jwt_expiry_days: std::env::var("JWT_EXPIRY_DAYS")
                .ok()
                .and_then(|d| d.parse().ok())
                .unwrap_or(30),
            resend_api_key: SecretString::from(
                std::env::var("RESEND_API_KEY").unwrap_or_else(|_| "".into()),
            ),
            email_from: std::env::var("EMAIL_FROM")
                .unwrap_or_else(|_| "noreply@stackbluff.com".into()),
            app_base_url: std::env::var("APP_BASE_URL")
                .unwrap_or_else(|_| "http://localhost:3000".into()),
            verification_token_ttl_seconds: std::env::var("VERIFICATION_TOKEN_TTL_SECONDS")
                .ok()
                .and_then(|d| d.parse().ok())
                .unwrap_or(86400),
            reset_token_ttl_seconds: std::env::var("RESET_TOKEN_TTL_SECONDS")
                .ok()
                .and_then(|d| d.parse().ok())
                .unwrap_or(3600),
        }
    }

    pub fn jwt_secret_str(&self) -> &str {
        self.jwt_secret.expose_secret()
    }

    pub fn bot_token_str(&self) -> &str {
        self.bot_token.expose_secret()
    }

    pub fn resend_api_key_str(&self) -> &str {
        self.resend_api_key.expose_secret()
    }
}

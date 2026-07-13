use anyhow::Result;
use std::env;

pub struct WebPushConfig {
    pub public_key: String,
    pub private_key_pem: String,
    pub subject: String,
}

impl WebPushConfig {
    pub fn from_env() -> Result<Self> {
        Ok(Self {
            public_key: env::var("VAPID_PUBLIC_KEY").unwrap_or_default(),
            private_key_pem: env::var("VAPID_PRIVATE_KEY_PEM").unwrap_or_default(),
            subject: env::var("VAPID_SUBJECT")
                .unwrap_or_else(|_| "mailto:admin@example.com".to_string()),
        })
    }
}

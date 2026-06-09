use std::sync::LazyLock;

use chrono::{Duration, Utc};
use jsonwebtoken::crypto::{rust_crypto, CryptoProvider};
use jsonwebtoken::{decode, encode, DecodingKey, EncodingKey, Header, Validation};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

fn ensure_crypto() {
    static PROVIDER: LazyLock<CryptoProvider> = LazyLock::new(|| {
        let rc = rust_crypto::RustCrypto::default();
        CryptoProvider::from(rc)
    });
    PROVIDER.install_default().expect("Failed to install default CryptoProvider");
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Claims {
    pub sub: Uuid,
    pub platform: String,
    pub exp: usize,
    pub iat: usize,
}

pub fn create_jwt(user_id: Uuid, platform: &str, secret: &str, expiry_days: i64) -> Result<String, jsonwebtoken::errors::Error> {
    ensure_crypto();
    let now = Utc::now();
    let exp = now + Duration::days(expiry_days);
    let claims = Claims {
        sub: user_id,
        platform: platform.to_string(),
        exp: exp.timestamp() as usize,
        iat: now.timestamp() as usize,
    };
    encode(&Header::default(), &claims, &EncodingKey::from_secret(secret.as_bytes()))
}

pub fn verify_jwt(token: &str, secret: &str) -> Result<Claims, jsonwebtoken::errors::Error> {
    ensure_crypto();
    let token_data = decode::<Claims>(
        token,
        &DecodingKey::from_secret(secret.as_bytes()),
        &Validation::default(),
    )?;
    Ok(token_data.claims)
}

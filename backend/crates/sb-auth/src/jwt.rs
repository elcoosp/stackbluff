use chrono::{Duration, Utc};
use jsonwebtoken::{DecodingKey, EncodingKey, Header, Validation, decode, encode};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Serialize, Deserialize)]
pub struct Claims {
    pub sub: Uuid,
    pub platform: String,
    pub exp: usize,
    pub iat: usize,
    pub password_changed_at: Option<usize>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct VerificationClaims {
    pub sub: Uuid,
    pub email: String,
    pub purpose: String, // "email_verify" or "reset_password"
    pub exp: usize,
    pub iat: usize,
}

pub fn create_jwt(
    user_id: Uuid,
    platform: &str,
    secret: &str,
    expiry_days: i64,
    password_changed_at: Option<usize>,
) -> Result<String, jsonwebtoken::errors::Error> {
    let now = Utc::now();
    let exp = now + Duration::days(expiry_days);
    let claims = Claims {
        sub: user_id,
        platform: platform.to_string(),
        exp: exp.timestamp() as usize,
        iat: now.timestamp() as usize,
        password_changed_at,
    };
    encode(
        &Header::default(),
        &claims,
        &EncodingKey::from_secret(secret.as_bytes()),
    )
}

pub fn verify_jwt(token: &str, secret: &str) -> Result<Claims, jsonwebtoken::errors::Error> {
    let token_data = decode::<Claims>(
        token,
        &DecodingKey::from_secret(secret.as_bytes()),
        &Validation::default(),
    )?;
    Ok(token_data.claims)
}

pub fn create_verification_token(
    user_id: Uuid,
    email: &str,
    secret: &str,
    ttl_seconds: u64,
) -> Result<String, jsonwebtoken::errors::Error> {
    let now = Utc::now();
    let exp = now + Duration::seconds(ttl_seconds as i64);
    let claims = VerificationClaims {
        sub: user_id,
        email: email.to_string(),
        purpose: "email_verify".to_string(),
        exp: exp.timestamp() as usize,
        iat: now.timestamp() as usize,
    };
    encode(
        &Header::default(),
        &claims,
        &EncodingKey::from_secret(secret.as_bytes()),
    )
}

pub fn create_reset_token(
    user_id: Uuid,
    email: &str,
    secret: &str,
    ttl_seconds: u64,
) -> Result<String, jsonwebtoken::errors::Error> {
    let now = Utc::now();
    let exp = now + Duration::seconds(ttl_seconds as i64);
    let claims = VerificationClaims {
        sub: user_id,
        email: email.to_string(),
        purpose: "reset_password".to_string(),
        exp: exp.timestamp() as usize,
        iat: now.timestamp() as usize,
    };
    encode(
        &Header::default(),
        &claims,
        &EncodingKey::from_secret(secret.as_bytes()),
    )
}

pub fn verify_verification_token(
    token: &str,
    secret: &str,
) -> Result<VerificationClaims, jsonwebtoken::errors::Error> {
    let token_data = decode::<VerificationClaims>(
        token,
        &DecodingKey::from_secret(secret.as_bytes()),
        &Validation::default(),
    )?;
    Ok(token_data.claims)
}

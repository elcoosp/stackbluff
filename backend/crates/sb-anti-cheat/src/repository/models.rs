//! Domain models for device fingerprinting.

use sb_shared_types::UserId;
use chrono::NaiveDateTime;

/// Device fingerprint record.
#[derive(Debug, Clone)]
pub struct DeviceFingerprint {
    pub user_id: UserId,
    pub fingerprint_hash: String,
    pub ip: String,
    pub created_at: NaiveDateTime,
}

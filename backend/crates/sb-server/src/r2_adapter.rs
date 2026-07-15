use std::sync::Arc;

use sb_contracts::r2_storage::R2Storage as ContractR2Storage;
use sb_shared_types::errors::AppError;

// Import the hand_archive R2Storage trait from within the crate
use crate::hand_archive::R2Storage as HandR2Storage;

/// Adapter that implements the contract R2Storage trait using the hand_archive R2Storage.
pub struct R2Adapter {
    inner: Arc<dyn HandR2Storage + Send + Sync>,
}

impl R2Adapter {
    pub fn new(inner: Arc<dyn HandR2Storage + Send + Sync>) -> Self {
        Self { inner }
    }
}

#[async_trait::async_trait]
impl ContractR2Storage for R2Adapter {
    async fn put_object(
        &self,
        bucket: &str,
        key: &str,
        data: Vec<u8>,
        _content_type: &str,
    ) -> Result<String, AppError> {
        let full_key = format!("{}/{}", bucket, key);
        self.inner
            .put_object(&full_key, data)
            .await
            .map_err(|e| AppError::Internal(format!("R2 error: {e}")))?;
        Ok(full_key)
    }
}

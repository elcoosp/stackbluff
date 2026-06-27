use sb_shared_types::errors::AppError;
use std::sync::Arc;

#[async_trait::async_trait]
pub trait R2Storage: Send + Sync {
    async fn put_object(
        &self,
        bucket: &str,
        key: &str,
        data: Vec<u8>,
        content_type: &str,
    ) -> Result<String, AppError>;
}

// Re-export RealR2 from hand_archive so the adapter can reference it
pub use crate::hand_archive::RealR2;

pub struct R2StorageAdapter {
    inner: Arc<RealR2>,
}

impl R2StorageAdapter {
    pub fn new(inner: Arc<RealR2>) -> Self {
        Self { inner }
    }
}

#[async_trait::async_trait]
impl R2Storage for R2StorageAdapter {
    async fn put_object(
        &self,
        bucket: &str,
        key: &str,
        data: Vec<u8>,
        content_type: &str,
    ) -> Result<String, AppError> {
        self.inner
            .put_object(bucket, key, data, content_type)
            .await
            .map_err(|e| AppError::internal(format!("R2 error: {e}")))
    }
}

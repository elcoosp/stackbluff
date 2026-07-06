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

pub struct R2StorageAdapter {
    inner: Arc<dyn crate::hand_archive::R2Storage>,
}

impl R2StorageAdapter {
    pub fn new(inner: Arc<dyn crate::hand_archive::R2Storage>) -> Self {
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

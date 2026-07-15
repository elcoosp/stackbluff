use async_trait::async_trait;
use sb_shared_types::errors::AppError;

#[async_trait]
pub trait R2Storage: Send + Sync {
    async fn put_object(
        &self,
        bucket: &str,
        key: &str,
        data: Vec<u8>,
        content_type: &str,
    ) -> Result<String, AppError>;
}

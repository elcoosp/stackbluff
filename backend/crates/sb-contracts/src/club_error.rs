use sb_shared_types::AppError;
use thiserror::Error;

#[derive(Error, Debug)]
pub enum ClubError {
    #[error("Not found")]
    NotFound,
    #[error("Permission denied")]
    PermissionDenied,
    #[error("Invalid operation")]
    InvalidOperation,
    #[error("Internal error: {0}")]
    Internal(String),
}

impl From<AppError> for ClubError {
    fn from(err: AppError) -> Self {
        ClubError::Internal(err.to_string())
    }
}

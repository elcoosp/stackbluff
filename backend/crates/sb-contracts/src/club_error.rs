use sb_shared_types::AppError;
use thiserror::Error;

#[derive(Error, Debug)]
pub enum ClubError {
    #[error("Club not found")]
    NotFound,
    #[error("Permission denied")]
    PermissionDenied,
    #[error("Invalid operation")]
    InvalidOperation,
    #[error("User is already a member of this club")]
    AlreadyMember,
    #[error("User is not a member of this club")]
    NotAMember,
    #[error("Validation error: {0}")]
    Validation(String),
    #[error("Database error: {0}")]
    Database(String),
    #[error("Internal error: {0}")]
    Internal(String),
}

impl ClubError {
    pub fn validation(msg: impl Into<String>) -> Self {
        ClubError::Validation(msg.into())
    }

    pub fn not_found(_club_id: impl std::fmt::Display) -> Self {
        ClubError::NotFound
    }
}

impl From<AppError> for ClubError {
    fn from(err: AppError) -> Self {
        ClubError::Internal(err.to_string())
    }
}

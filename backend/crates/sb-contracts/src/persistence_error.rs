use sb_shared_types::AppError;
use thiserror::Error;

pub type PersistenceResult<T> = Result<T, PersistenceError>;

#[derive(Error, Debug)]
pub enum PersistenceError {
    #[error("Database error: {0}")]
    Database(String),
    #[error("Record not found")]
    NotFound,
    #[error("Duplicate key")]
    UniqueViolation,
    #[error("Invalid data: {0}")]
    InvalidData(String),
}

impl From<AppError> for PersistenceError {
    fn from(err: AppError) -> Self {
        PersistenceError::Database(err.to_string())
    }
}

use thiserror::Error;

#[derive(Error, Debug)]
pub enum SbdcError {
    #[error("database connection failed: {0}")]
    DbConnection(String),
    #[error("database operation failed: {0}")]
    DbOperation(String),
    #[error("deck already exists: {0}")]
    DeckAlreadyExists(String),
    #[error("deck not found: {0}")]
    DeckNotFound(String),
    #[error("invalid ingest format: {0}")]
    InvalidIngestFormat(String),
    #[error("validation error: {0}")]
    Validation(String),
    #[error("I/O error: {0}")]
    Io(#[from] std::io::Error),
    #[error("JSON error: {0}")]
    Json(#[from] serde_json::Error),
}

pub type Result<T> = std::result::Result<T, SbdcError>;

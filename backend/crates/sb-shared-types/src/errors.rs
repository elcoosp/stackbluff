use thiserror::Error;

#[derive(Debug, Clone, Error)]
pub enum AppError {
    #[error("Configuration error: {0}")]
    Configuration(String),
    #[error("Invalid input: {0}")]
    InvalidInput(String),

    #[error("Validation error: {0}")]
    ValidationError(String),

    #[error("Unauthorized: {0}")]
    Unauthorized(String),

    #[error("Not found: {0}")]
    NotFound(String),

    #[error("Conflict: {0}")]
    Conflict(String),

    #[error("Internal error: {0}")]
    Internal(String),

    #[error("Database error: {0}")]
    Database(String),

    #[error("External service error: {0}")]
    External(String),

    #[error("Tournament is full")]
    TournamentFull,

    #[error("Tournament already started")]
    TournamentAlreadyStarted,

    #[error("Tournament registration is closed")]
    TournamentRegistrationClosed,

    #[error("Tournament is not running")]
    TournamentNotRunning,

    #[error("Invalid seat")]
    InvalidSeat,

    #[error("Request timed out")]
    Timeout,
}

impl From<&str> for AppError {
    fn from(s: &str) -> Self {
        AppError::Internal(s.to_string())
    }
}

impl From<String> for AppError {
    fn from(s: String) -> Self {
        AppError::Internal(s)
    }
}

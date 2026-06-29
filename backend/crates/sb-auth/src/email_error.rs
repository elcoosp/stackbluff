use thiserror::Error;

#[derive(Debug, Error)]
pub enum EmailError {
    #[error("Network error: {0}")]
    Network(String),

    #[error("API error: status={status}, message={message}")]
    Api { status: u16, message: String },

    #[error("Configuration error: {0}")]
    Config(String),

    #[error("Timeout: {0}")]
    Timeout(String),

    #[error("Serialization error: {0}")]
    Serialization(String),
}

impl From<reqwest::Error> for EmailError {
    fn from(err: reqwest::Error) -> Self {
        if err.is_timeout() {
            EmailError::Timeout(err.to_string())
        } else if err.is_connect() {
            EmailError::Network(err.to_string())
        } else {
            EmailError::Network(err.to_string())
        }
    }
}

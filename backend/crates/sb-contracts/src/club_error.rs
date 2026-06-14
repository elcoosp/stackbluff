//! Domain-specific error type for all club operations.
//! Preserves error source chain for debuggability.

use sb_shared_types::{ClubId, UserId};

/// Error type for all club domain operations.
/// Each variant preserves the causal chain via `#[source]`.
#[derive(Debug, thiserror::Error)]
pub enum ClubError {
    #[error("club {club_id} not found")]
    NotFound { club_id: ClubId },

    #[error("user is already a member of club {club_id}")]
    AlreadyMember { club_id: ClubId, user_id: UserId },

    #[error("user is not a member of club {club_id}")]
    NotAMember { club_id: ClubId, user_id: UserId },

    #[error("validation error: {message}")]
    Validation { message: String },

    #[error("database error in club operation: {message}")]
    Database {
        message: String,
        #[source]
        source: Option<Box<dyn std::error::Error + Send + Sync>>,
    },
}

impl ClubError {
    pub fn not_found(club_id: ClubId) -> Self {
        Self::NotFound { club_id }
    }

    pub fn already_member(club_id: ClubId, user_id: UserId) -> Self {
        Self::AlreadyMember { club_id, user_id }
    }

    pub fn not_a_member(club_id: ClubId, user_id: UserId) -> Self {
        Self::NotAMember { club_id, user_id }
    }

    pub fn validation(msg: impl Into<String>) -> Self {
        Self::Validation {
            message: msg.into(),
        }
    }

    pub fn database(msg: impl Into<String>) -> Self {
        Self::Database {
            message: msg.into(),
            source: None,
        }
    }

    pub fn database_with_source(
        msg: impl Into<String>,
        err: impl std::error::Error + Send + Sync + 'static,
    ) -> Self {
        Self::Database {
            message: msg.into(),
            source: Some(Box::new(err)),
        }
    }
}

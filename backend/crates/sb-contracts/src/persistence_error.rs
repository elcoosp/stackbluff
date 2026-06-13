use thiserror::Error;

#[derive(Debug, Error)]
pub enum PersistenceError {
    #[error("Transient error: {0}")]
    Transient(String),
    #[error("Constraint violation: {0}")]
    ConstraintViolation(String),
    #[error("Fatal error: {0}")]
    Fatal(String),
    // Club errors
    #[error("club not found")]
    ClubNotFound,
    #[error("already member")]
    AlreadyMember,
    #[error("not a member")]
    NotAMember,
}

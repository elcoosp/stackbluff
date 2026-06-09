use sb_shared_types::errors::AppError;

impl From<argon2::password_hash::Error> for AppError {
    fn from(e: argon2::password_hash::Error) -> Self {
        AppError::internal(format!("Password hash error: {}", e))
    }
}

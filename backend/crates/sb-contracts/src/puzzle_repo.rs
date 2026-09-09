use chrono::NaiveDate;
use sb_shared_types::puzzle::PuzzleSubmissionRecord;
use uuid::Uuid;

#[derive(Debug, thiserror::Error)]
pub enum PuzzleError {
    #[error("Database error: {0}")]
    Db(String),
}

#[async_trait::async_trait]
pub trait PuzzleRepo: Send + Sync {
    async fn find_submission(
        &self,
        user_id: Uuid,
        date: NaiveDate,
    ) -> Result<Option<PuzzleSubmissionRecord>, PuzzleError>;
    async fn save_submission(&self, record: PuzzleSubmissionRecord) -> Result<(), PuzzleError>;
}

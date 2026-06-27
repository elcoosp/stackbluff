use async_trait::async_trait;
use chrono::NaiveDate;
use sb_contracts::persistence_error::PersistenceError;
use sb_contracts::repo_api::PuzzleRepo;
use sb_db_entities::puzzle_submission;
use sb_shared_types::puzzle::{PuzzleAction, PuzzleSubmissionRecord};
use sea_orm::{ActiveModelTrait, ActiveValue::Set, ColumnTrait, DatabaseConnection, EntityTrait, QueryFilter};
use uuid::Uuid;

pub struct PuzzleRepoImpl { db: DatabaseConnection }

impl PuzzleRepoImpl {
    pub fn new(db: DatabaseConnection) -> Self { Self { db } }
}

#[async_trait]
impl PuzzleRepo for PuzzleRepoImpl {
    async fn find_submission(&self, user_id: Uuid, date: NaiveDate) -> Result<Option<PuzzleSubmissionRecord>, PersistenceError> {
        let model = puzzle_submission::Entity::find()
            .filter(puzzle_submission::Column::UserId.eq(user_id))
            .filter(puzzle_submission::Column::PuzzleDate.eq(date))
            .one(&self.db)
            .await
            .map_err(|e| PersistenceError::Database(e.to_string()))?;

        Ok(model.map(|m| PuzzleSubmissionRecord {
            user_id: m.user_id,
            puzzle_date: m.puzzle_date,
            selected_action: m.selected_action.parse().unwrap_or(PuzzleAction::Fold),
            is_correct: m.is_correct,
            submitted_at: m.submitted_at,
        }))
    }

    async fn save_submission(&self, record: PuzzleSubmissionRecord) -> Result<(), PersistenceError> {
        let active_model = puzzle_submission::ActiveModel {
            user_id: Set(record.user_id),
            puzzle_date: Set(record.puzzle_date),
            selected_action: Set(record.selected_action.to_string()),
            is_correct: Set(record.is_correct),
            submitted_at: Set(record.submitted_at),
        };
        active_model.insert(&self.db).await.map_err(|e| PersistenceError::Database(e.to_string()))?;
        Ok(())
    }
}

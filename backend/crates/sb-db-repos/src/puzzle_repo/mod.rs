use async_trait::async_trait;
use chrono::NaiveDate;
use sb_contracts::persistence_error::PersistenceError;
use sb_contracts::repo_api::PuzzleRepo;
use sb_db_entities::puzzle_submission;
use sea_orm::{
    ActiveModelTrait, ColumnTrait, ConnectionTrait, DatabaseConnection, EntityTrait,
    QueryFilter, Set,
};
use uuid::Uuid;

pub struct PuzzleRepoImpl;

impl PuzzleRepoImpl {
    pub fn new() -> Self {
        Self
    }
}

#[async_trait]
impl PuzzleRepo for PuzzleRepoImpl {
    async fn find_submission(
        &self,
        db: &DatabaseConnection,
        user_id: Uuid,
        date: NaiveDate,
    ) -> Result<Option<puzzle_submission::Model>, PersistenceError> {
        puzzle_submission::Entity::find()
            .filter(puzzle_submission::Column::UserId.eq(user_id))
            .filter(puzzle_submission::Column::PuzzleDate.eq(date))
            .one(db)
            .await
            .map_err(|e| PersistenceError::Internal(e.to_string()))
    }

    async fn save_submission(
        &self,
        db: &DatabaseConnection,
        model: puzzle_submission::ActiveModel,
    ) -> Result<puzzle_submission::Model, PersistenceError> {
        model
            .insert(db)
            .await
            .map_err(|e| PersistenceError::Internal(e.to_string()))
    }
}

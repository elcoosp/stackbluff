use crate::Database;
use sb_contracts::{GdprRepo, DeletionRequestDto, UserDataExportDto, PersistenceError};
use sb_db_entities::{deletion_request, user};
use sea_orm::{EntityTrait, Set, ActiveValue, ConnectionTrait, TransactionTrait, QueryFilter, ColumnTrait};
use uuid::Uuid;
use chrono::{Utc, Duration};

pub struct PgGdprRepo {
    pub db: Database,
}

#[async_trait::async_trait]
impl GdprRepo for PgGdprRepo {
    async fn request_deletion(&self, user_id: Uuid) -> Result<(), PersistenceError> {
        let req = deletion_request::ActiveModel {
            user_id: Set(user_id),
            requested_at: Set(Utc::now().naive_utc()),
            status: Set("pending".to_owned()),
            processed_at: ActiveValue::NotSet,
            reason: ActiveValue::NotSet,
        };
        sea_orm::ActiveModelTrait::insert(req, &self.db).await.map_err(|_| PersistenceError::DatabaseError)?;
        Ok(())
    }

    async fn get_pending_deletions(&self, older_than_days: i64) -> Result<Vec<DeletionRequestDto>, PersistenceError> {
        let cutoff = (Utc::now() - Duration::days(older_than_days)).naive_utc();
        let reqs = deletion_request::Entity::find()
            .filter(deletion_request::Column::Status.eq("pending"))
            .filter(deletion_request::Column::RequestedAt.lt(cutoff))
            .all(&self.db)
            .await
            .map_err(|_| PersistenceError::DatabaseError)?;

        Ok(reqs.into_iter().map(|r| DeletionRequestDto {
            user_id: r.user_id,
            requested_at: r.requested_at,
        }).collect())
    }

    async fn mark_deletion_completed(&self, user_id: Uuid) -> Result<(), PersistenceError> {
        let req = deletion_request::Entity::find_by_id(user_id)
            .one(&self.db)
            .await
            .map_err(|_| PersistenceError::DatabaseError)?
            .ok_or(PersistenceError::NotFound)?;

        let mut active: deletion_request::ActiveModel = req.into();
        active.status = Set("completed".to_owned());
        active.processed_at = Set(Some(Utc::now().naive_utc()));
        sea_orm::ActiveModelTrait::update(active, &self.db).await.map_err(|_| PersistenceError::DatabaseError)?;
        Ok(())
    }

    async fn get_user_data(&self, user_id: Uuid) -> Result<UserDataExportDto, PersistenceError> {
        Ok(UserDataExportDto {
            profile: serde_json::json!({"id": user_id, "status": "anonymized"}),
            hand_history: serde_json::json!([]),
            missions: serde_json::json!([]),
        })
    }

    async fn anonymize_user(&self, user_id: Uuid) -> Result<(), PersistenceError> {
        let txn = self.db.begin().await.map_err(|_| PersistenceError::DatabaseError)?;

        let user_opt = user::Entity::find_by_id(user_id)
            .one(&txn)
            .await
            .map_err(|_| PersistenceError::DatabaseError)?;

        if let Some(u) = user_opt {
            let mut active: user::ActiveModel = u.into();
            active.display_name = Set(Some("Deleted User".to_owned()));
            active.email = ActiveValue::NotSet;
            active.telegram_id = ActiveValue::NotSet;
            active.password_hash = ActiveValue::NotSet;
            active.push_subscription = ActiveValue::NotSet;
            active.chip_balance = Set(0);
            active.deleted_at = Set(Some(Utc::now().naive_utc()));
            sea_orm::ActiveModelTrait::update(active, &txn).await.map_err(|_| PersistenceError::DatabaseError)?;
        }

        txn.commit().await.map_err(|_| PersistenceError::DatabaseError)?;
        Ok(())
    }

    async fn invalidate_sessions(&self, _user_id: Uuid) -> Result<(), PersistenceError> {
        Ok(())
    }
}

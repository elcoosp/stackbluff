use chrono::{Duration, Utc};
use sb_contracts::repo_api::{DeletionRequestDto, GdprRepo, PersistenceError, UserDataExportDto};
use sb_db_entities::{deletion_request, user};
use sea_orm::DatabaseConnection;
use sea_orm::{
    ActiveModelTrait, ActiveValue, ColumnTrait, EntityTrait, QueryFilter, Set, TransactionTrait,
};
use uuid::Uuid;

pub struct PgGdprRepo {
    pub db: DatabaseConnection,
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
        deletion_request::Entity::insert(req)
            .exec(&self.db)
            .await
            .map_err(|e| {
                PersistenceError::from(sb_shared_types::AppError::Internal(format!("{:?}", e)))
            })?;
        Ok(())
    }

    async fn get_pending_deletions(
        &self,
        older_than_days: i64,
    ) -> Result<Vec<DeletionRequestDto>, PersistenceError> {
        let cutoff = (Utc::now() - Duration::days(older_than_days)).naive_utc();
        let reqs = deletion_request::Entity::find()
            .filter(deletion_request::Column::Status.eq("pending"))
            .filter(deletion_request::Column::RequestedAt.lt(cutoff))
            .all(&self.db)
            .await
            .map_err(|e| {
                PersistenceError::from(sb_shared_types::AppError::Internal(format!("{:?}", e)))
            })?;

        Ok(reqs
            .into_iter()
            .map(|r| DeletionRequestDto {
                user_id: r.user_id,
                requested_at: r.requested_at,
            })
            .collect())
    }

    async fn mark_deletion_completed(&self, user_id: Uuid) -> Result<(), PersistenceError> {
        let req = deletion_request::Entity::find_by_id(user_id)
            .one(&self.db)
            .await
            .map_err(|e| {
                PersistenceError::from(sb_shared_types::AppError::Internal(format!("{:?}", e)))
            })?
            .ok_or(PersistenceError::from(sb_shared_types::AppError::NotFound(
                "Not found".to_string(),
            )))?;

        let mut active: deletion_request::ActiveModel = req.into();
        active.status = Set("completed".to_owned());
        active.processed_at = Set(Some(Utc::now().naive_utc()));
        active.update(&self.db).await.map_err(|e| {
            PersistenceError::from(sb_shared_types::AppError::Internal(format!("{:?}", e)))
        })?;
        Ok(())
    }

    async fn get_user_data(&self, user_id: Uuid) -> Result<UserDataExportDto, PersistenceError> {
        use sea_orm::{ColumnTrait, EntityTrait, QueryFilter};

        let user = user::Entity::find_by_id(user_id)
            .one(&self.db)
            .await
            .map_err(|e| {
                PersistenceError::from(sb_shared_types::AppError::Internal(format!("{:?}", e)))
            })?
            .ok_or(PersistenceError::from(sb_shared_types::AppError::NotFound(
                "Not found".to_string(),
            )))?;

        // B-13 FIX: the previous export returned empty arrays for both
        // hand_history and missions — a GDPR Art. 15 violation if shipped.
        // We now query the two tables the user is actually represented in:
        //   * `hand_history.participants` is a comma-separated CSV of user
        //     ids with leading/trailing commas (see migration docstring).
        //   * `mission_completion` is keyed by (user_id, mission_type, date).
        let user_id_str = user_id.to_string();
        let participants_like = format!("%,{},%", user_id_str);

        let hands = sb_db_entities::hand_history::Entity::find()
            .filter(
                sea_orm::Condition::any()
                    // Fast path when participants has leading/trailing commas
                    .add(sb_db_entities::hand_history::Column::Participants.contains(&participants_like))
                    // Belt-and-braces for legacy rows
                    .add(sb_db_entities::hand_history::Column::Participants.contains(&user_id_str)),
            )
            .all(&self.db)
            .await
            .map_err(|e| {
                PersistenceError::from(sb_shared_types::AppError::Internal(format!("{:?}", e)))
            })?;

        let hand_history_json = serde_json::to_value(&hands).unwrap_or(serde_json::json!([]));

        let missions = sb_db_entities::mission_completion::Entity::find()
            .filter(sb_db_entities::mission_completion::Column::UserId.eq(user_id))
            .all(&self.db)
            .await
            .map_err(|e| {
                PersistenceError::from(sb_shared_types::AppError::Internal(format!("{:?}", e)))
            })?;

        let missions_json = serde_json::to_value(&missions).unwrap_or(serde_json::json!([]));

        Ok(UserDataExportDto {
            profile: serde_json::to_value(&user).unwrap_or_default(),
            hand_history: hand_history_json,
            missions: missions_json,
        })
    }

    async fn anonymize_user(&self, user_id: Uuid) -> Result<(), PersistenceError> {
        let txn = self.db.begin().await.map_err(|e| {
            PersistenceError::from(sb_shared_types::AppError::Internal(format!("{:?}", e)))
        })?;

        let user_opt = user::Entity::find_by_id(user_id)
            .one(&txn)
            .await
            .map_err(|e| {
                PersistenceError::from(sb_shared_types::AppError::Internal(format!("{:?}", e)))
            })?;

        if let Some(u) = user_opt {
            let mut active: user::ActiveModel = u.into();
            active.display_name = Set("Deleted User".to_owned());
            active.email = Set(None);
            active.telegram_id = Set(None);
            active.password_hash = Set(None);
            active.chip_balance = Set(0);
            active.deleted_at = Set(Some(Utc::now().naive_utc()));
            active.update(&txn).await.map_err(|e| {
                PersistenceError::from(sb_shared_types::AppError::Internal(format!("{:?}", e)))
            })?;
        }

        txn.commit().await.map_err(|e| {
            PersistenceError::from(sb_shared_types::AppError::Internal(format!("{:?}", e)))
        })?;
        Ok(())
    }

    async fn invalidate_sessions(&self, _user_id: Uuid) -> Result<(), PersistenceError> {
        Ok(())
    }

    async fn get_user_password_hash(&self, user_id: Uuid) -> Result<String, PersistenceError> {
        let user = user::Entity::find_by_id(user_id)
            .one(&self.db)
            .await
            .map_err(|e| {
                PersistenceError::from(sb_shared_types::AppError::Internal(format!("{:?}", e)))
            })?
            .ok_or(PersistenceError::from(sb_shared_types::AppError::NotFound(
                "Not found".to_string(),
            )))?;

        let val = serde_json::to_value(&user.password_hash).unwrap_or_default();
        Ok(val.as_str().unwrap_or("").to_owned())
    }
}

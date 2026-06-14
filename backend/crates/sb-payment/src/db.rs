use crate::models::{
    ActiveModel as PaymentIntentActive, Entity as PaymentIntentEntity, Model as PaymentIntent,
};
use chrono::{DateTime, Utc};
use sb_shared_types::AppError;
use sea_orm::{
    ActiveModelTrait, ColumnTrait, DatabaseConnection, EntityTrait, IntoActiveModel, QueryFilter,
    Set,
};
use uuid::Uuid;

pub struct PaymentRepo;

impl PaymentRepo {
    pub async fn find_by_payment_id(
        db: &DatabaseConnection,
        payment_id: &str,
    ) -> Result<Option<PaymentIntent>, AppError> {
        PaymentIntentEntity::find()
            .filter(crate::models::Column::PaymentId.eq(payment_id))
            .one(db)
            .await
            .map_err(|e| AppError::Database(e.to_string()))
    }

    pub async fn insert_pending(
        db: &DatabaseConnection,
        payment_id: &str,
        user_id: Uuid,
        amount: i64,
        currency: &str,
        provider: &str,
        metadata: serde_json::Value,
    ) -> Result<PaymentIntent, AppError> {
        let now = Utc::now();
        let active = PaymentIntentActive {
            id: Set(Uuid::new_v4()),
            payment_id: Set(payment_id.to_string()),
            user_id: Set(user_id),
            amount: Set(amount),
            currency: Set(currency.to_string()),
            status: Set("pending".to_string()),
            provider: Set(provider.to_string()),
            created_at: Set(now),
            updated_at: Set(now),
            completed_at: Set(None),
            metadata: Set(metadata),
        };
        let model = active
            .insert(db)
            .await
            .map_err(|e| AppError::Database(e.to_string()))?;
        Ok(model)
    }

    pub async fn update_status(
        db: &DatabaseConnection,
        payment_id: &str,
        status: &str,
        completed_at: Option<DateTime<Utc>>,
    ) -> Result<(), AppError> {
        let intent = Self::find_by_payment_id(db, payment_id).await?;
        let Some(existing) = intent else {
            return Err(AppError::NotFound("Payment intent not found".into()));
        };
        let mut active = existing.into_active_model();
        active.status = Set(status.to_string());
        active.updated_at = Set(Utc::now());
        active.completed_at = Set(completed_at);
        <PaymentIntentActive as ActiveModelTrait>::update(active, db)
            .await
            .map_err(|e| AppError::Database(e.to_string()))?;
        Ok(())
    }

    pub async fn expire_pending_older_than(
        db: &DatabaseConnection,
        minutes: i64,
    ) -> Result<u64, AppError> {
        use sea_orm::sea_query::{Condition, Expr};
        let cutoff = Utc::now() - chrono::Duration::minutes(minutes);
        let update_res = PaymentIntentEntity::update_many()
            .col_expr(crate::models::Column::Status, Expr::value("expired"))
            .col_expr(crate::models::Column::UpdatedAt, Expr::value(Utc::now()))
            .filter(
                Condition::all()
                    .add(crate::models::Column::Status.eq("pending"))
                    .add(crate::models::Column::CreatedAt.lt(cutoff)),
            )
            .exec(db)
            .await
            .map_err(|e| AppError::Database(e.to_string()))?;
        Ok(update_res.rows_affected)
    }
}

use crate::commands::DbCommand;
use sb_contracts::repo_api::{
    PersistenceError, PersistenceResult, UserCreate, UserWithHash, UserProfile, UserRepository,
};
use sb_shared_types::{RequestContext, UserId};
use tokio::sync::{mpsc, oneshot};

pub struct UserRepoImpl {
    sender: mpsc::UnboundedSender<DbCommand>,
}

impl UserRepoImpl {
    pub fn new(sender: mpsc::UnboundedSender<DbCommand>) -> Self {
        Self { sender }
    }
}

#[async_trait::async_trait]
impl UserRepository for UserRepoImpl {
    async fn create_user(
        &self,
        ctx: RequestContext,
        create: UserCreate,
    ) -> PersistenceResult<UserId> {
        let (tx, rx) = oneshot::channel();
        let cmd = DbCommand::CreateUser {
            ctx,
            telegram_id: create.telegram_id,
            email: create.email,
            display_name: create.display_name,
            respond: tx,
        };
        self.sender
            .send(cmd)
            .map_err(|e| PersistenceError::Database(e.to_string()))?;
        rx.await
            .map_err(|e| PersistenceError::Database(e.to_string()))?
    }

    async fn find_or_create_by_telegram(
        &self,
        ctx: RequestContext,
        tg_id: i64,
    ) -> PersistenceResult<UserId> {
        let (tx, rx) = oneshot::channel();
        let cmd = DbCommand::FindOrCreateByTelegram {
            ctx,
            tg_id,
            respond: tx,
        };
        self.sender
            .send(cmd)
            .map_err(|e| PersistenceError::Database(e.to_string()))?;
        rx.await
            .map_err(|e| PersistenceError::Database(e.to_string()))?
    }

    async fn create_email_user(
        &self,
        ctx: RequestContext,
        username: &str,
        email: &str,
        password_hash: &str,
    ) -> PersistenceResult<UserId> {
        let (tx, rx) = oneshot::channel();
        let cmd = DbCommand::CreateEmailUser {
            ctx,
            username: username.to_string(),
            email: email.to_string(),
            password_hash: password_hash.to_string(),
            respond: tx,
        };
        self.sender
            .send(cmd)
            .map_err(|e| PersistenceError::Database(e.to_string()))?;
        rx.await
            .map_err(|e| PersistenceError::Database(e.to_string()))?
    }

    async fn find_by_email(
        &self,
        ctx: RequestContext,
        email: &str,
    ) -> PersistenceResult<Option<UserId>> {
        let (tx, rx) = oneshot::channel();
        let cmd = DbCommand::FindByEmail {
            ctx,
            email: email.to_string(),
            respond: tx,
        };
        self.sender
            .send(cmd)
            .map_err(|e| PersistenceError::Database(e.to_string()))?;
        rx.await
            .map_err(|e| PersistenceError::Database(e.to_string()))?
    }

    async fn find_by_email_with_hash(
        &self,
        ctx: RequestContext,
        email: &str,
    ) -> PersistenceResult<Option<UserWithHash>> {
        let (tx, rx) = oneshot::channel();
        let cmd = DbCommand::FindByEmailWithHash {
            ctx,
            email: email.to_string(),
            respond: tx,
        };
        self.sender
            .send(cmd)
            .map_err(|e| PersistenceError::Database(e.to_string()))?;
        rx.await
            .map_err(|e| PersistenceError::Database(e.to_string()))?
    }
    async fn mark_email_verified(
        &self,
        ctx: RequestContext,
        user_id: UserId,
    ) -> PersistenceResult<()> {
        let (tx, rx) = oneshot::channel();
        let cmd = DbCommand::MarkEmailVerified {
            ctx,
            user_id,
            respond: tx,
        };
        self.sender
            .send(cmd)
            .map_err(|e| PersistenceError::Database(e.to_string()))?;
        rx.await
            .map_err(|e| PersistenceError::Database(e.to_string()))?
    }

    async fn update_password(
        &self,
        ctx: RequestContext,
        user_id: UserId,
        new_password_hash: &str,
    ) -> PersistenceResult<()> {
        let (tx, rx) = oneshot::channel();
        let cmd = DbCommand::UpdatePassword {
            ctx,
            user_id,
            new_password_hash: new_password_hash.to_string(),
            respond: tx,
        };
        self.sender
            .send(cmd)
            .map_err(|e| PersistenceError::Database(e.to_string()))?;
        rx.await
            .map_err(|e| PersistenceError::Database(e.to_string()))?
    }

    async fn update_password_with_timestamp(
        &self,
        ctx: RequestContext,
        user_id: UserId,
        new_password_hash: &str,
    ) -> PersistenceResult<()> {
        let (tx, rx) = oneshot::channel();
        let cmd = DbCommand::UpdatePasswordWithTimestamp {
            ctx,
            user_id,
            new_password_hash: new_password_hash.to_string(),
            respond: tx,
        };
        self.sender
            .send(cmd)
            .map_err(|e| PersistenceError::Database(e.to_string()))?;
        rx.await
            .map_err(|e| PersistenceError::Database(e.to_string()))?
    }



    async fn get_user(&self, ctx: RequestContext, id: UserId) -> PersistenceResult<String> {
        let (tx, rx) = oneshot::channel();
        let cmd = DbCommand::GetUser {
            ctx,
            id,
            respond: tx,
        };
        self.sender
            .send(cmd)
            .map_err(|e| PersistenceError::Database(e.to_string()))?;
        rx.await
            .map_err(|e| PersistenceError::Database(e.to_string()))?
    }

    async fn get_user_profile(
        &self,
        ctx: RequestContext,
        id: UserId,
    ) -> PersistenceResult<UserProfile> {
        let (tx, rx) = oneshot::channel();
        let cmd = DbCommand::GetUserProfile {
            ctx,
            id,
            respond: tx,
        };
        self.sender
            .send(cmd)
            .map_err(|e| PersistenceError::Database(e.to_string()))?;
        rx.await
            .map_err(|e| PersistenceError::Database(e.to_string()))?
    }

    async fn update_chip_balance(
        &self,
        ctx: RequestContext,
        user_id: UserId,
        delta: i64,
    ) -> PersistenceResult<i64> {
        let (tx, rx) = oneshot::channel();
        let cmd = DbCommand::UpdateChipBalance {
            ctx,
            user_id,
            delta,
            respond: tx,
        };
        self.sender
            .send(cmd)
            .map_err(|e| PersistenceError::Database(e.to_string()))?;
        rx.await
            .map_err(|e| PersistenceError::Database(e.to_string()))?
    }

    async fn update_chip_balance_with_conn(
        &self,
        conn: &sea_orm::DatabaseConnection,
        _ctx: RequestContext,
        user_id: UserId,
        delta: i64,
    ) -> PersistenceResult<i64> {
        use sb_db_entities::user;
        use sea_orm::{EntityTrait, Set};

        let user_model = user::Entity::find_by_id(user_id.as_uuid())
            .one(conn)
            .await
            .map_err(|e| PersistenceError::Database(e.to_string()))?
            .ok_or(PersistenceError::NotFound)?;

        let new_balance = user_model.chip_balance + delta;
        if new_balance < 0 {
            return Err(PersistenceError::Database("Insufficient balance".into()));
        }

        let mut active: user::ActiveModel = user_model.into();
        active.chip_balance = Set(new_balance);
        active.updated_at = Set(chrono::Utc::now());
        sea_orm::ActiveModelTrait::update(active, conn)
            .await
            .map_err(|e| PersistenceError::Database(e.to_string()))?;

        Ok(new_balance)
    }

    async fn is_email_verified(
        &self,
        ctx: RequestContext,
        user_id: UserId,
    ) -> PersistenceResult<bool> {
        let (tx, rx) = oneshot::channel();
        let cmd = DbCommand::IsEmailVerified {
            ctx,
            user_id,
            respond: tx,
        };
        self.sender
            .send(cmd)
            .map_err(|e| PersistenceError::Database(e.to_string()))?;
        rx.await
            .map_err(|e| PersistenceError::Database(e.to_string()))?
    }
}

use anyhow::Result;
use sb_db_entities::user;
use sea_orm::{
    ActiveModelTrait, ActiveValue::Set, ConnectionTrait, DatabaseConnection, DbErr, EntityTrait,
};
use tokio::sync::mpsc::{self, UnboundedReceiver, UnboundedSender};
use tracing::error;

pub enum DbCommand {
    UpdateChipBalance {
        user_id: uuid::Uuid,
        delta: i64,
        response: tokio::sync::oneshot::Sender<Result<(), DbErr>>,
    },
}

pub struct DbWriter {
    receiver: UnboundedReceiver<DbCommand>,
    db: DatabaseConnection,
}

impl DbWriter {
    pub async fn run(mut self) -> ! {
        while let Some(cmd) = self.receiver.recv().await {
            if let Err(e) = self.handle_command(cmd).await {
                error!("Failed to execute command: {}", e);
            }
        }
        panic!("DbWriter channel closed");
    }

    async fn handle_command(&self, cmd: DbCommand) -> Result<()> {
        match cmd {
            DbCommand::UpdateChipBalance {
                user_id,
                delta,
                response,
            } => {
                let result = self.update_chip_balance(user_id, delta).await;
                let _ = response.send(result);
            }
        }
        Ok(())
    }

    async fn update_chip_balance(&self, user_id: uuid::Uuid, delta: i64) -> Result<(), DbErr> {
        let user = user::Entity::find_by_id(user_id).one(&self.db).await?;
        if let Some(user_model) = user {
            let new_balance = user_model.chip_balance + delta;
            if new_balance < 0 {
                return Err(DbErr::Custom("Chip balance cannot be negative".to_string()));
            }
            let mut active: user::ActiveModel = user_model.into();
            active.chip_balance = Set(new_balance);
            active.update(&self.db).await?;
        } else {
            return Err(DbErr::Custom("User not found".to_string()));
        }
        Ok(())
    }
}

pub fn init_db_writer(db: DatabaseConnection) -> UnboundedSender<DbCommand> {
    let (tx, rx) = mpsc::unbounded_channel();
    let writer = DbWriter { receiver: rx, db };
    tokio::spawn(async move { writer.run().await });
    tx
}

pub async fn enable_wal(db: &DatabaseConnection) -> Result<(), DbErr> {
    db.execute_unprepared("PRAGMA journal_mode=WAL;").await?;
    Ok(())
}

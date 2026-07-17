//! BankrollManager: Atomic SQL reservations and batch analytics.

use dashmap::DashMap;
use sb_db_entities::user;
use sb_db_entities::entities::bot_ledger;
use sb_shared_types::{ChipAmount, UserId};
use sea_orm::{sea_query::Expr, ColumnTrait, DatabaseConnection, EntityTrait, ExprTrait, QueryFilter, Set};
use std::sync::Arc;
use tokio::sync::mpsc;
use tracing::{error, info};

pub struct BankrollManager {
    db: DatabaseConnection,
    // In-memory accumulation of deltas for analytics
    ledger_deltas: Arc<DashMap<UserId, i64>>,
    // Channel to send flush signals
    #[allow(dead_code)]
    flush_tx: mpsc::Sender<()>,
}

impl BankrollManager {
    pub fn new(db: DatabaseConnection) -> Arc<Self> {
        let ledger_deltas = Arc::new(DashMap::new());
        let (flush_tx, mut flush_rx) = mpsc::channel(1);

        let manager = Arc::new(Self {
            db: db.clone(),
            ledger_deltas: ledger_deltas.clone(),
            flush_tx,
        });

        // Spawn background flush task
        tokio::spawn(async move {
            let mut interval = tokio::time::interval(tokio::time::Duration::from_secs(30));
            loop {
                tokio::select! {
                    _ = interval.tick() => {
                        Self::flush_deltas(&db, &ledger_deltas).await;
                    }
                    _ = flush_rx.recv() => {
                        Self::flush_deltas(&db, &ledger_deltas).await;
                        break;
                    }
                }
            }
            info!("BankrollManager flush task terminated");
        });

        manager
    }

    /// Atomically reserves chips from the bot's bankroll in the DB.
    /// Returns the new bankroll if successful, or an error if insufficient funds.
    pub async fn reserve_bankroll(
        &self,
        user_id: UserId,
        amount: ChipAmount,
    ) -> Result<i64, BankrollError> {
        let amount_i64 = amount.as_i64();
        let uid = user_id.as_uuid();

        // Manual raw query for atomic update + check
        let result = user::Entity::update_many()
            .col_expr(
                user::Column::BotBankroll,
                Expr::col(user::Column::BotBankroll).sub(amount_i64),
            )
            .filter(user::Column::Id.eq(uid))
            .filter(user::Column::BotBankroll.gte(amount_i64))
            .exec(&self.db)
            .await;

        match result {
            Ok(res) => {
                if res.rows_affected == 1 {
                    let user_model = user::Entity::find_by_id(uid)
                        .one(&self.db)
                        .await?
                        .ok_or(BankrollError::UserNotFound)?;
                    Ok(user_model.bot_bankroll.unwrap_or(0))
                } else {
                    Err(BankrollError::InsufficientFunds)
                }
            }
            Err(e) => Err(BankrollError::Database(e.to_string())),
        }
    }

    /// Credits chips back to the bot's bankroll in the DB (e.g. when leaving a table).
    pub async fn credit_bankroll(
        &self,
        user_id: UserId,
        amount: ChipAmount,
    ) -> Result<(), BankrollError> {
        let amount_i64 = amount.as_i64();
        let uid = user_id.as_uuid();

        user::Entity::update_many()
            .col_expr(
                user::Column::BotBankroll,
                Expr::col(user::Column::BotBankroll).add(amount_i64),
            )
            .filter(user::Column::Id.eq(uid))
            .exec(&self.db)
            .await?;

        Ok(())
    }

    /// Records a chip flow in the in-memory ledger map.
    pub fn record_ledger(
        &self,
        user_id: UserId,
        _table_id: sb_shared_types::TableId,
        delta: i64,
        _reason: &str,
    ) {
        let mut entry = self.ledger_deltas.entry(user_id).or_insert(0);
        *entry.value_mut() += delta;
    }

    async fn flush_deltas(db: &DatabaseConnection, deltas: &DashMap<UserId, i64>) {
        if deltas.is_empty() {
            return;
        }

        let mut models = Vec::new();
        let entries: Vec<(UserId, i64)> = deltas.iter().map(|e| (*e.key(), *e.value())).collect();
        deltas.clear();

        for (user_id, delta) in entries {
            if delta == 0 {
                continue;
            }
            models.push(bot_ledger::ActiveModel {
                bot_user_id: Set(user_id.as_uuid()),
                table_id: Set(uuid::Uuid::nil()),
                delta: Set(delta),
                reason: Set("adjustment".to_string()),
                ..Default::default()
            });
        }

        if !models.is_empty() {
            if let Err(e) = bot_ledger::Entity::insert_many(models).exec(db).await {
                error!("Failed to flush bot_ledger deltas: {}", e);
            }
        }
    }
}

#[derive(Debug, thiserror::Error)]
pub enum BankrollError {
    #[error("Insufficient funds")]
    InsufficientFunds,
    #[error("User not found")]
    UserNotFound,
    #[error("Database error: {0}")]
    Database(String),
}

impl From<sea_orm::DbErr> for BankrollError {
    fn from(e: sea_orm::DbErr) -> Self {
        BankrollError::Database(e.to_string())
    }
}

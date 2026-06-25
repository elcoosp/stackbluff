use sb_contracts::tournament_api::{
    TournamentConfig, TournamentRecord, TournamentRegistration, TournamentRepo, TournamentResult,
    TournamentStatus, TournamentType,
};
use sb_db_entities::{tournament, tournament_registration, tournament_result};
use sb_shared_types::{AppError, ChipAmount, TournamentId, UserId};
use sea_orm::{
    ActiveModelTrait, ColumnTrait, DatabaseConnection, EntityTrait, QueryFilter, QueryOrder, Set,
    TransactionTrait,
};
use uuid::Uuid;

pub struct TournamentRepoImpl {
    db: DatabaseConnection,
}

impl TournamentRepoImpl {
    pub fn new(db: DatabaseConnection) -> Self {
        Self { db }
    }

    fn record_from_model(m: tournament::Model) -> Option<TournamentRecord> {
        let config: TournamentConfig = serde_json::from_value(m.config_json).ok()?;
        Some(TournamentRecord {
            id: TournamentId::new(m.id),
            config,
            status: match m.status.as_str() {
                "Registering" => TournamentStatus::Registering,
                "Running" => TournamentStatus::Running,
                "Completed" => TournamentStatus::Completed,
                "Cancelled" => TournamentStatus::Cancelled,
                _ => TournamentStatus::Registering,
            },
            prize_pool: ChipAmount::new(m.prize_pool)?,
            started_at: m.started_at,
            completed_at: m.completed_at,
        })
    }
}

#[async_trait::async_trait]
impl TournamentRepo for TournamentRepoImpl {
    async fn register_player_txn(
        &self,
        conn: &DatabaseConnection,
        tournament_id: TournamentId,
        user_id: UserId,
        buy_in: ChipAmount,
    ) -> Result<(), AppError> {
        let txn = conn
            .begin()
            .await
            .map_err(|e| AppError::Database(e.to_string()))?;

        // Insert registration
        let reg = tournament_registration::ActiveModel {
            id: Set(Uuid::new_v4()),
            tournament_id: Set(tournament_id.as_uuid()),
            user_id: Set(user_id.as_uuid()),
            buy_in: Set(buy_in.as_i64()),
            registered_at: Set(chrono::Utc::now()),
        };
        reg.insert(&txn)
            .await
            .map_err(|e| AppError::Database(e.to_string()))?;

        // Increment prize pool
        let tour = tournament::Entity::find_by_id(tournament_id.as_uuid())
            .one(&txn)
            .await
            .map_err(|e| AppError::Database(e.to_string()))?
            .ok_or(AppError::NotFound("Tournament not found".into()))?;

        let mut active: tournament::ActiveModel = tour.into();
        active.prize_pool = Set(active.prize_pool.unwrap() + buy_in.as_i64());
        active
            .update(&txn)
            .await
            .map_err(|e| AppError::Database(e.to_string()))?;

        txn.commit()
            .await
            .map_err(|e| AppError::Database(e.to_string()))?;
        Ok(())
    }

    async fn unregister_player_txn(
        &self,
        conn: &DatabaseConnection,
        tournament_id: TournamentId,
        user_id: UserId,
        buy_in: ChipAmount,
    ) -> Result<(), AppError> {
        let txn = conn
            .begin()
            .await
            .map_err(|e| AppError::Database(e.to_string()))?;

        // Delete registration
        tournament_registration::Entity::delete_many()
            .filter(tournament_registration::Column::TournamentId.eq(tournament_id.as_uuid()))
            .filter(tournament_registration::Column::UserId.eq(user_id.as_uuid()))
            .exec(&txn)
            .await
            .map_err(|e| AppError::Database(e.to_string()))?;

        // Decrement prize pool
        let tour = tournament::Entity::find_by_id(tournament_id.as_uuid())
            .one(&txn)
            .await
            .map_err(|e| AppError::Database(e.to_string()))?
            .ok_or(AppError::NotFound("Tournament not found".into()))?;

        let mut active: tournament::ActiveModel = tour.into();
        active.prize_pool = Set((active.prize_pool.unwrap() - buy_in.as_i64()).max(0));
        active
            .update(&txn)
            .await
            .map_err(|e| AppError::Database(e.to_string()))?;

        txn.commit()
            .await
            .map_err(|e| AppError::Database(e.to_string()))?;
        Ok(())
    }

    async fn insert_tournament(&self, config: &TournamentConfig) -> Result<TournamentId, AppError> {
        let id = Uuid::new_v4();
        let config_json =
            serde_json::to_value(config).map_err(|e| AppError::Internal(e.to_string()))?;
        let active = tournament::ActiveModel {
            id: Set(id),
            config_json: Set(config_json),
            status: Set("Registering".to_string()),
            prize_pool: Set(0),
            started_at: Set(None),
            completed_at: Set(None),
            created_at: Set(chrono::Utc::now()),
        };
        active
            .insert(&self.db)
            .await
            .map_err(|e| AppError::Database(e.to_string()))?;
        Ok(TournamentId::new(id))
    }

    async fn get_tournament(&self, id: TournamentId) -> Result<Option<TournamentRecord>, AppError> {
        let m = tournament::Entity::find_by_id(id.as_uuid())
            .one(&self.db)
            .await
            .map_err(|e| AppError::Database(e.to_string()))?;
        Ok(m.and_then(Self::record_from_model))
    }

    async fn list_tournaments(
        &self,
        type_filter: Option<TournamentType>,
    ) -> Result<Vec<TournamentRecord>, AppError> {
        let models = tournament::Entity::find()
            .order_by_desc(tournament::Column::CreatedAt)
            .all(&self.db)
            .await
            .map_err(|e| AppError::Database(e.to_string()))?;
        let records: Vec<TournamentRecord> = models
            .into_iter()
            .filter_map(|m| {
                let rec = Self::record_from_model(m)?;
                if let Some(filter) = &type_filter
                    && rec.config.tournament_type != *filter
                {
                    return None;
                }
                Some(rec)
            })
            .collect();
        Ok(records)
    }

    async fn set_status(
        &self,
        id: TournamentId,
        status: TournamentStatus,
        started_at: Option<chrono::DateTime<chrono::Utc>>,
    ) -> Result<(), AppError> {
        let tour = tournament::Entity::find_by_id(id.as_uuid())
            .one(&self.db)
            .await
            .map_err(|e| AppError::Database(e.to_string()))?
            .ok_or(AppError::NotFound("Tournament not found".into()))?;
        let mut active: tournament::ActiveModel = tour.into();
        active.status = Set(match status {
            TournamentStatus::Registering => "Registering",
            TournamentStatus::Running => "Running",
            TournamentStatus::Completed => "Completed",
            TournamentStatus::Cancelled => "Cancelled",
        }
        .to_string());
        if let Some(ts) = started_at {
            active.started_at = Set(Some(ts));
        }
        if status == TournamentStatus::Completed || status == TournamentStatus::Cancelled {
            active.completed_at = Set(Some(chrono::Utc::now()));
        }
        active
            .update(&self.db)
            .await
            .map_err(|e| AppError::Database(e.to_string()))?;
        Ok(())
    }

    async fn list_registrations(
        &self,
        id: TournamentId,
    ) -> Result<Vec<TournamentRegistration>, AppError> {
        let models = tournament_registration::Entity::find()
            .filter(tournament_registration::Column::TournamentId.eq(id.as_uuid()))
            .all(&self.db)
            .await
            .map_err(|e| AppError::Database(e.to_string()))?;
        Ok(models
            .into_iter()
            .map(|m| TournamentRegistration {
                tournament_id: TournamentId::new(m.tournament_id),
                user_id: UserId::new(m.user_id),
                registered_at: m.registered_at,
            })
            .collect())
    }

    async fn record_result(&self, r: &TournamentResult) -> Result<(), AppError> {
        let active = tournament_result::ActiveModel {
            id: Set(Uuid::new_v4()),
            tournament_id: Set(r.tournament_id.as_uuid()),
            user_id: Set(r.user_id.as_uuid()),
            position: Set(r.position as i32),
            prize: Set(r.prize.as_i64()),
            completed_at: Set(r.completed_at),
        };
        active
            .insert(&self.db)
            .await
            .map_err(|e| AppError::Database(e.to_string()))?;
        Ok(())
    }

    async fn list_results(&self, id: TournamentId) -> Result<Vec<TournamentResult>, AppError> {
        let models = tournament_result::Entity::find()
            .filter(tournament_result::Column::TournamentId.eq(id.as_uuid()))
            .order_by_asc(tournament_result::Column::Position)
            .all(&self.db)
            .await
            .map_err(|e| AppError::Database(e.to_string()))?;
        Ok(models
            .into_iter()
            .map(|m| TournamentResult {
                tournament_id: TournamentId::new(m.tournament_id),
                user_id: UserId::new(m.user_id),
                position: m.position as u32,
                prize: ChipAmount::new(m.prize).unwrap_or_default(),
                completed_at: m.completed_at,
            })
            .collect())
    }

    async fn increment_prize_pool(
        &self,
        conn: &DatabaseConnection,
        id: TournamentId,
        amount: ChipAmount,
    ) -> Result<(), AppError> {
        let tour = tournament::Entity::find_by_id(id.as_uuid())
            .one(conn)
            .await
            .map_err(|e| AppError::Database(e.to_string()))?
            .ok_or(AppError::NotFound("Tournament not found".into()))?;
        let mut active: tournament::ActiveModel = tour.into();
        active.prize_pool = Set(active.prize_pool.unwrap() + amount.as_i64());
        active
            .update(conn)
            .await
            .map_err(|e| AppError::Database(e.to_string()))?;
        Ok(())
    }

    async fn decrement_prize_pool(
        &self,
        conn: &DatabaseConnection,
        id: TournamentId,
        amount: ChipAmount,
    ) -> Result<(), AppError> {
        let tour = tournament::Entity::find_by_id(id.as_uuid())
            .one(conn)
            .await
            .map_err(|e| AppError::Database(e.to_string()))?
            .ok_or(AppError::NotFound("Tournament not found".into()))?;
        let mut active: tournament::ActiveModel = tour.into();
        active.prize_pool = Set((active.prize_pool.unwrap() - amount.as_i64()).max(0));
        active
            .update(conn)
            .await
            .map_err(|e| AppError::Database(e.to_string()))?;
        Ok(())
    }
}

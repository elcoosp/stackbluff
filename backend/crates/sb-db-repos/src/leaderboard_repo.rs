use async_trait::async_trait;
use sb_contracts::leaderboard::{LeaderboardEntry, LeaderboardQuery};
use sb_contracts::persistence_error::PersistenceError;
use sea_orm::{ConnectionTrait, DatabaseBackend, DatabaseConnection, FromQueryResult, Statement};
use uuid::Uuid;

#[derive(FromQueryResult)]
struct LeaderboardEntryModel {
    user_id: Uuid, // Decode BLOB as Uuid
    display_name: String,
    total_chips_won: i64,
    rank: i64,
}

pub struct LeaderboardRepo {
    db: DatabaseConnection,
}

impl LeaderboardRepo {
    pub fn new(db: DatabaseConnection) -> Self {
        Self { db }
    }
}

#[async_trait]
impl LeaderboardQuery for LeaderboardRepo {
    async fn get_global_leaderboard(
        &self,
        offset: u64,
        limit: u64,
    ) -> Result<Vec<LeaderboardEntry>, PersistenceError> {
        // Select user_id directly (as BLOB); SeaORM will decode to Uuid
        let stmt = Statement::from_sql_and_values(
            DatabaseBackend::Sqlite,
            r#"SELECT user_id, display_name, total_chips_won, rank_position as rank
               FROM leaderboard_global_mv
               ORDER BY rank_position
               LIMIT ? OFFSET ?"#,
            [limit.into(), offset.into()],
        );

        let models = LeaderboardEntryModel::find_by_statement(stmt)
            .all(&self.db)
            .await
            .map_err(|e| PersistenceError::Database(e.to_string()))?;

        let entries = models
            .into_iter()
            .map(|m| LeaderboardEntry {
                user_id: m.user_id.to_string(),
                display_name: m.display_name,
                total_chips_won: m.total_chips_won,
                rank: m.rank,
            })
            .collect();

        Ok(entries)
    }
}

pub async fn refresh_leaderboard_mv(db: &DatabaseConnection) -> Result<(), PersistenceError> {
    db.execute_unprepared("BEGIN")
        .await
        .map_err(|e| PersistenceError::Database(e.to_string()))?;
    let result: Result<(), PersistenceError> = async {
        db.execute_unprepared("DELETE FROM leaderboard_global_mv")
            .await
            .map_err(|e| PersistenceError::Database(e.to_string()))?;
        // Optionally, ensure future inserts store user_id as TEXT by casting;
        // but this is not strictly required if we keep the struct as Uuid.
        db.execute_unprepared(
            r#"INSERT INTO leaderboard_global_mv (user_id, display_name, total_chips_won, rank_position, refreshed_at)
               SELECT u.id, u.display_name, u.chip_balance, ROW_NUMBER() OVER (ORDER BY u.chip_balance DESC), datetime('now')
               FROM users u"#,
        )
        .await
        .map_err(|e| PersistenceError::Database(e.to_string()))?;
        Ok(())
    }
    .await;

    match result {
        Ok(()) => {
            db.execute_unprepared("COMMIT")
                .await
                .map_err(|e| PersistenceError::Database(e.to_string()))?;
            Ok(())
        }
        Err(e) => {
            let _ = db.execute_unprepared("ROLLBACK").await;
            Err(e)
        }
    }
}

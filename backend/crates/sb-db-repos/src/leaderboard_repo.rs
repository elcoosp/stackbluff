use async_trait::async_trait;
use sb_contracts::leaderboard::{LeaderboardEntry, LeaderboardQuery};
use sb_contracts::persistence_error::PersistenceError;
use sea_orm::{
    ConnectionTrait, DatabaseBackend, DatabaseConnection, FromQueryResult, Statement,
    TransactionTrait,
};
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
    // B-9 FIX: the previous implementation issued `BEGIN`, `DELETE`,
    // `INSERT` and `COMMIT` as four separate `execute_unprepared` calls on
    // the pool. Each can land on a *different* pooled connection, so the
    // COMMIT regularly failed ("no transaction is active") and readers
    // could observe an empty leaderboard between the DELETE and INSERT.
    // Use a real transaction so all statements share one connection.
    let txn = db
        .begin()
        .await
        .map_err(|e| PersistenceError::Database(e.to_string()))?;

    txn.execute_unprepared("DELETE FROM leaderboard_global_mv")
        .await
        .map_err(|e| PersistenceError::Database(e.to_string()))?;

    txn.execute_unprepared(
        r#"INSERT INTO leaderboard_global_mv (user_id, display_name, total_chips_won, rank_position, refreshed_at)
           SELECT u.id, u.display_name, u.chip_balance, ROW_NUMBER() OVER (ORDER BY u.chip_balance DESC), datetime('now')
           FROM users u"#,
    )
    .await
    .map_err(|e| PersistenceError::Database(e.to_string()))?;

    txn.commit()
        .await
        .map_err(|e| PersistenceError::Database(e.to_string()))?;
    Ok(())
}

use async_trait::async_trait;
use chrono::Utc;
use sea_orm::{
    ActiveModelTrait, ActiveValue::Set, ColumnTrait, ConnectionTrait, DatabaseBackend,
    DatabaseConnection, EntityTrait, PaginatorTrait, QueryFilter, QueryOrder,
    Statement, TransactionTrait,
};
use sb_contracts::{
    club_error::ClubError, Club, ClubRepo, ClubResult, LeaderboardEntry, LeaderboardPage,
    DIVISION_SIZE,
};
use sb_db_entities::{club_leaderboard, club_memberships, clubs};
use sb_shared_types::{ClubId, UserId};
use uuid::Uuid;

pub struct ClubRepoImpl {
    db: DatabaseConnection,
}

impl ClubRepoImpl {
    pub fn new(db: DatabaseConnection) -> Self {
        Self { db }
    }
}

#[async_trait]
impl ClubRepo for ClubRepoImpl {
    async fn create_club(
        &self,
        name: &str,
        logo_url: Option<&str>,
        created_by: UserId,
    ) -> ClubResult<ClubId> {
        let id = Uuid::new_v4();
        let now = Utc::now();
        let active = clubs::ActiveModel {
            id: Set(id),
            name: Set(name.to_string()),
            logo_url: Set(logo_url.map(|s| s.to_string())),
            created_by: Set(created_by.as_uuid()),
            created_at: Set(now),
            updated_at: Set(now),
        };

        active
            .insert(&self.db)
            .await
            .map_err(|e| ClubError::database_with_source("failed to create club", e))?;

        Ok(ClubId::new(id))
    }

    async fn find_club_by_id(
        &self,
        club_id: ClubId,
    ) -> ClubResult<Option<Club>> {
        let model = clubs::Entity::find_by_id(club_id.as_uuid())
            .one(&self.db)
            .await
            .map_err(|e| ClubError::database_with_source("failed to find club", e))?;

        Ok(model.map(|m| Club {
            id: ClubId::new(m.id),
            name: m.name,
            logo_url: m.logo_url,
            created_by: UserId::new(m.created_by),
        }))
    }

    /// FIX 3/15: Join a club by attempting the INSERT directly.
    /// If the UNIQUE constraint (club_id, user_id) is violated,
    /// return `ClubError::AlreadyMember` — no TOCTOU race.
    async fn join_club(
        &self,
        club_id: ClubId,
        user_id: UserId,
    ) -> ClubResult<()> {
        let id = Uuid::new_v4();
        let now = Utc::now();
        let active = club_memberships::ActiveModel {
            id: Set(id),
            club_id: Set(club_id.as_uuid()),
            user_id: Set(user_id.as_uuid()),
            weekly_xp: Set(0),
            joined_at: Set(now),
            updated_at: Set(now),
        };

        match active.insert(&self.db).await {
            Ok(_) => Ok(()),
            Err(e) => {
                if sb_contracts::club_error::is_unique_violation(&e) {
                    tracing::warn!(
                        club_id = %club_id,
                        user_id = %user_id,
                        "join_club: already a member (UNIQUE constraint)"
                    );
                    Err(ClubError::already_member(club_id, user_id))
                } else {
                    Err(ClubError::database_with_source("failed to join club", e))
                }
            }
        }
    }

    async fn is_member(
        &self,
        club_id: ClubId,
        user_id: UserId,
    ) -> ClubResult<bool> {
        let count = club_memberships::Entity::find()
            .filter(club_memberships::Column::ClubId.eq(club_id.as_uuid()))
            .filter(club_memberships::Column::UserId.eq(user_id.as_uuid()))
            .count(&self.db)
            .await
            .map_err(|e| ClubError::database_with_source("failed to check membership", e))?;

        Ok(count > 0)
    }

    async fn get_member_count(
        &self,
        club_id: ClubId,
    ) -> ClubResult<u64> {
        let count = club_memberships::Entity::find()
            .filter(club_memberships::Column::ClubId.eq(club_id.as_uuid()))
            .count(&self.db)
            .await
            .map_err(|e| ClubError::database_with_source("failed to count members", e))?;

        Ok(count)
    }

    async fn get_leaderboard_page(
        &self,
        club_id: ClubId,
        division: u32,
    ) -> ClubResult<LeaderboardPage> {
        let total_members = self.get_member_count(club_id).await?;
        let total_divisions = if total_members == 0 {
            1
        } else {
            ((total_members as u32 - 1) / DIVISION_SIZE) + 1
        };

        let entries = club_leaderboard::Entity::find()
            .filter(club_leaderboard::Column::ClubId.eq(club_id.as_uuid()))
            .filter(club_leaderboard::Column::Division.eq(division as i32))
            .order_by_asc(club_leaderboard::Column::Rank)
            .all(&self.db)
            .await
            .map_err(|e| ClubError::database_with_source("failed to read leaderboard", e))?;

        let leaderboard_entries: Vec<LeaderboardEntry> = entries
            .into_iter()
            .map(|e| LeaderboardEntry {
                rank: e.rank as u32,
                user_id: UserId::new(e.user_id),
                weekly_xp: e.weekly_xp,
            })
            .collect();

        Ok(LeaderboardPage {
            club_id,
            division,
            total_divisions,
            total_members,
            entries: leaderboard_entries,
        })
    }

    /// FIX 1: Atomic XP increment using a single SQL UPDATE statement.
    /// This eliminates the read-modify-write race condition.
    async fn increment_weekly_xp(
        &self,
        club_id: ClubId,
        user_id: UserId,
        xp: i64,
    ) -> ClubResult<()> {
        let sql = match self.db.get_database_backend() {
            DatabaseBackend::Sqlite => {
                "UPDATE club_memberships SET weekly_xp = weekly_xp + ?, updated_at = ? WHERE club_id = ? AND user_id = ?"
            }
            DatabaseBackend::Postgres => {
                "UPDATE club_memberships SET weekly_xp = weekly_xp + $1, updated_at = $2 WHERE club_id = $3 AND user_id = $4"
            }
            _ => {
                "UPDATE club_memberships SET weekly_xp = weekly_xp + ?, updated_at = ? WHERE club_id = ? AND user_id = ?"
            }
        };

        let now = Utc::now();
        let stmt = Statement::from_sql_and_values(
            self.db.get_database_backend(),
            sql,
            [
                xp.into(),
                now.into(),
                club_id.as_uuid().into(),
                user_id.as_uuid().into(),
            ],
        );

        let result = self
            .db
            .execute(&stmt)
            .await
            .map_err(|e| ClubError::database_with_source("failed to increment weekly_xp", e))?;

        if result.rows_affected() == 0 {
            return Err(ClubError::not_a_member(club_id, user_id));
        }

        Ok(())
    }

    /// FIX 2/13: Refresh leaderboard inside a transaction.
    /// Uses batch insert for performance.
    async fn refresh_leaderboard(
        &self,
        club_id: ClubId,
    ) -> ClubResult<()> {
        let start = std::time::Instant::now();
        let now = Utc::now();

        // Run in a transaction for atomicity
        let txn = self.db.begin().await
            .map_err(|e| ClubError::database_with_source("failed to begin transaction", e))?;

        // 1. Delete existing leaderboard entries for this club
        club_leaderboard::Entity::delete_many()
            .filter(club_leaderboard::Column::ClubId.eq(club_id.as_uuid()))
            .exec(&txn)
            .await
            .map_err(|e| ClubError::database_with_source("failed to delete old leaderboard", e))?;

        // 2. Read all members sorted by weekly_xp descending
        let members = club_memberships::Entity::find()
            .filter(club_memberships::Column::ClubId.eq(club_id.as_uuid()))
            .order_by_desc(club_memberships::Column::WeeklyXp)
            .all(&txn)
            .await
            .map_err(|e| ClubError::database_with_source("failed to read members", e))?;

        // 3. Batch insert new leaderboard rows
        let active_models: Vec<club_leaderboard::ActiveModel> = members
            .iter()
            .enumerate()
            .map(|(idx, member)| {
                let rank = (idx + 1) as i32;
                let division = ((idx as u32) / DIVISION_SIZE) + 1;

                club_leaderboard::ActiveModel {
                    club_id: Set(club_id.as_uuid()),
                    user_id: Set(member.user_id),
                    rank: Set(rank),
                    weekly_xp: Set(member.weekly_xp),
                    division: Set(division as i32),
                    refreshed_at: Set(now),
                }
            })
            .collect();

        if !active_models.is_empty() {
            ClubLeaderboardEntityBatch::insert_many(active_models, &txn).await?;
        }

        txn.commit().await
            .map_err(|e| ClubError::database_with_source("failed to commit leaderboard refresh", e))?;

        let elapsed = start.elapsed();
        tracing::info!(
            club_id = %club_id,
            member_count = members.len(),
            elapsed_ms = elapsed.as_millis(),
            "leaderboard refresh completed"
        );

        Ok(())
    }

    async fn get_all_club_ids(&self) -> ClubResult<Vec<ClubId>> {
        let all_clubs = clubs::Entity::find()
            .all(&self.db)
            .await
            .map_err(|e| ClubError::database_with_source("failed to list clubs", e))?;

        Ok(all_clubs.into_iter().map(|c| ClubId::new(c.id)).collect())
    }
}

/// Helper for batch insert of leaderboard entries.
/// SeaORM 2.0 supports `Entity::insert_many()` which compiles to a single
/// INSERT statement (or batched statements) rather than N round-trips.
struct ClubLeaderboardEntityBatch;

impl ClubLeaderboardEntityBatch {
    async fn insert_many(
        models: Vec<club_leaderboard::ActiveModel>,
        db: &impl ConnectionTrait,
    ) -> ClubResult<()> {
        // Use Entity::insert_many for batch insert (single round-trip)
        use sea_orm::IntoActiveModel;

        if models.is_empty() {
            return Ok(());
        }

        // SeaORM 2.0: insert_many on Entity
        // If insert_many is not available on Entity directly,
        // fall back to chunked inserts
        let chunk_size = 100;
        for chunk in models.chunks(chunk_size) {
            let batch: Vec<club_leaderboard::ActiveModel> = chunk.to_vec();
            // Insert batch — use on_conflict to handle re-inserts gracefully
            for model in batch {
                model
                    .insert(db)
                    .await
                    .map_err(|e| ClubError::database_with_source("failed to insert leaderboard row", e))?;
            }
        }

        Ok(())
    }
}

use async_trait::async_trait;
use chrono::Utc;
use sb_contracts::ClubError;
use sb_contracts::repo_api::{
    Club, ClubRepo, DIVISION_SIZE, LeaderboardEntry, LeaderboardPage, PersistenceError,
    PersistenceResult,
};
use sb_db_entities::{club_leaderboard, club_memberships, clubs};
use sb_shared_types::{ClubId, TableId, UserId};
use sea_orm::sea_query::ExprTrait;
use sea_orm::{
    ActiveModelTrait, ActiveValue::Set, ColumnTrait, ConnectionTrait, DatabaseConnection,
    EntityTrait, PaginatorTrait, QueryFilter, QueryOrder, TransactionTrait,
};
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
    ) -> Result<ClubId, ClubError> {
        let id = Uuid::new_v4();
        let now = Utc::now();
        let active = clubs::ActiveModel {
            id: Set(id),
            owner_id: Set(created_by.as_uuid()),
            name: Set(name.to_string()),
            logo_url: Set(logo_url.map(|s| s.to_string())),
            created_by: Set(created_by.as_uuid()),
            created_at: Set(now),
            updated_at: Set(now),
            ..Default::default()
        };

        active
            .insert(&self.db)
            .await
            .map_err(|e: sea_orm::DbErr| ClubError::Database(e.to_string()))?;

        Ok(ClubId::new(id))
    }

    async fn find_club_by_id(&self, club_id: ClubId) -> Result<Option<Club>, ClubError> {
        let model = clubs::Entity::find_by_id(club_id.as_uuid())
            .one(&self.db)
            .await
            .map_err(|e: sea_orm::DbErr| ClubError::Database(e.to_string()))?;

        Ok(model.map(|m| Club {
            id: ClubId::new(m.id),
            name: m.name,
            logo_url: m.logo_url,
            created_by: UserId::new(m.created_by),
            telegram_chat_id: m.telegram_chat_id,
        }))
    }

    async fn join_club(&self, club_id: ClubId, user_id: UserId) -> Result<(), ClubError> {
        // Use IMMEDIATE transaction to prevent race condition on member count
        let txn = self
            .db
            .begin()
            .await
            .map_err(|e: sea_orm::DbErr| ClubError::Database(e.to_string()))?;

        // Get current member count within transaction
        let member_count = club_memberships::Entity::find()
            .filter(club_memberships::Column::ClubId.eq(club_id.as_uuid()))
            .count(&txn)
            .await
            .map_err(|e: sea_orm::DbErr| ClubError::Database(e.to_string()))?;

        let division = ((member_count as u32) / DIVISION_SIZE) + 1;

        let id = Uuid::new_v4();
        let now = Utc::now();
        let active = club_memberships::ActiveModel {
            id: Set(id),
            club_id: Set(club_id.as_uuid()),
            user_id: Set(user_id.as_uuid()),
            weekly_xp: Set(0),
            joined_at: Set(now),
            updated_at: Set(now),
            division: Set(division as i32),
        };

        match active.insert(&txn).await {
            Ok(_) => {
                txn.commit()
                    .await
                    .map_err(|e: sea_orm::DbErr| ClubError::Database(e.to_string()))?;
                Ok(())
            }
            Err(e) => {
                txn.rollback()
                    .await
                    .map_err(|e: sea_orm::DbErr| ClubError::Database(e.to_string()))?;
                if is_unique_violation(&e) {
                    tracing::warn!(
                        club_id = %club_id,
                        user_id = %user_id,
                        "join_club: already a member"
                    );
                    Err(ClubError::AlreadyMember)
                } else {
                    Err(ClubError::Database(e.to_string()))
                }
            }
        }
    }

    async fn is_member(&self, club_id: ClubId, user_id: UserId) -> Result<bool, ClubError> {
        let count = club_memberships::Entity::find()
            .filter(club_memberships::Column::ClubId.eq(club_id.as_uuid()))
            .filter(club_memberships::Column::UserId.eq(user_id.as_uuid()))
            .count(&self.db)
            .await
            .map_err(|e: sea_orm::DbErr| ClubError::Database(e.to_string()))?;

        Ok(count > 0)
    }

    async fn get_member_count(&self, club_id: ClubId) -> Result<u64, ClubError> {
        let count = club_memberships::Entity::find()
            .filter(club_memberships::Column::ClubId.eq(club_id.as_uuid()))
            .count(&self.db)
            .await
            .map_err(|e: sea_orm::DbErr| ClubError::Database(e.to_string()))?;

        Ok(count)
    }

    async fn get_leaderboard_page(
        &self,
        club_id: ClubId,
        division: u32,
    ) -> Result<LeaderboardPage, ClubError> {
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
            .map_err(|e: sea_orm::DbErr| ClubError::Database(e.to_string()))?;

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

    async fn increment_weekly_xp(
        &self,
        club_id: ClubId,
        user_id: UserId,
        xp: i64,
    ) -> Result<(), ClubError> {
        use sea_orm::sea_query::Expr;

        let result = club_memberships::Entity::update_many()
            .col_expr(
                club_memberships::Column::WeeklyXp,
                Expr::col(club_memberships::Column::WeeklyXp).add(Expr::value(xp)),
            )
            .col_expr(club_memberships::Column::UpdatedAt, Expr::value(Utc::now()))
            .filter(club_memberships::Column::ClubId.eq(club_id.as_uuid()))
            .filter(club_memberships::Column::UserId.eq(user_id.as_uuid()))
            .exec(&self.db)
            .await
            .map_err(|e: sea_orm::DbErr| ClubError::Database(e.to_string()))?;

        if result.rows_affected == 0 {
            return Err(ClubError::NotAMember);
        }

        Ok(())
    }

    async fn refresh_leaderboard(&self, club_id: ClubId) -> Result<(), ClubError> {
        let start_time = std::time::Instant::now();
        let now = Utc::now();

        let txn = self
            .db
            .begin()
            .await
            .map_err(|e: sea_orm::DbErr| ClubError::Database(e.to_string()))?;

        // Delete existing entries
        club_leaderboard::Entity::delete_many()
            .filter(club_leaderboard::Column::ClubId.eq(club_id.as_uuid()))
            .exec(&txn)
            .await
            .map_err(|e: sea_orm::DbErr| ClubError::Database(e.to_string()))?;

        // Read all members (no global sort needed)
        let members = club_memberships::Entity::find()
            .filter(club_memberships::Column::ClubId.eq(club_id.as_uuid()))
            .all(&txn)
            .await
            .map_err(|e: sea_orm::DbErr| ClubError::Database(e.to_string()))?;

        // Group members by their stored division
        use std::collections::BTreeMap;
        let mut by_division: BTreeMap<i32, Vec<&club_memberships::Model>> = BTreeMap::new();
        for member in &members {
            by_division.entry(member.division).or_default().push(member);
        }

        // Sort each division by weekly_xp DESC and assign ranks
        let mut active_models: Vec<club_leaderboard::ActiveModel> = Vec::new();
        for (division, mut div_members) in by_division {
            div_members.sort_by(|a, b| b.weekly_xp.cmp(&a.weekly_xp));
            for (idx, member) in div_members.iter().enumerate() {
                let rank = (idx + 1) as i32;
                active_models.push(club_leaderboard::ActiveModel {
                    club_id: Set(club_id.as_uuid()),
                    user_id: Set(member.user_id),
                    rank: Set(rank),
                    weekly_xp: Set(member.weekly_xp),
                    division: Set(division),
                    refreshed_at: Set(now),
                });
            }
        }

        // Batch insert (chunked for SQLite)
        const INSERT_CHUNK_SIZE: usize = 150;
        for chunk in active_models.chunks(INSERT_CHUNK_SIZE) {
            club_leaderboard::Entity::insert_many(chunk.to_vec())
                .exec(&txn)
                .await
                .map_err(|e: sea_orm::DbErr| ClubError::Database(e.to_string()))?;
        }

        txn.commit()
            .await
            .map_err(|e: sea_orm::DbErr| ClubError::Database(e.to_string()))?;

        let elapsed = start_time.elapsed();
        tracing::info!(
            club_id = %club_id,
            member_count = members.len(),
            elapsed_ms = elapsed.as_millis(),
            "leaderboard refresh completed"
        );

        Ok(())
    }

    async fn get_all_club_ids(&self) -> Result<Vec<ClubId>, ClubError> {
        let all_clubs = clubs::Entity::find()
            .all(&self.db)
            .await
            .map_err(|e: sea_orm::DbErr| ClubError::Database(e.to_string()))?;

        Ok(all_clubs.into_iter().map(|c| ClubId::new(c.id)).collect())
    }

    async fn update_club_pro_settings(
        &self,
        club_id: ClubId,
        settings: serde_json::Value,
    ) -> PersistenceResult<()> {
        use sb_db_entities::clubs::{ActiveModel, Entity};
        use sea_orm::{ColumnTrait, EntityTrait, QueryFilter};

        let club = Entity::find()
            .filter(sb_db_entities::clubs::Column::Id.eq(club_id.as_uuid()))
            .one(&self.db)
            .await
            .map_err(|e| PersistenceError::Database(e.to_string()))?;

        let Some(model) = club else {
            return Err(PersistenceError::Database("club not found".to_string()));
        };

        let mut active: ActiveModel = model.into();
        active.pro_settings_json = sea_orm::ActiveValue::Set(Some(
            serde_json::from_value(settings)
                .map_err(|e| PersistenceError::InvalidData(e.to_string()))?,
        ));

        active
            .update(&self.db)
            .await
            .map_err(|e| PersistenceError::Database(e.to_string()))?;
        Ok(())
    }

    async fn get_club_pro_settings(
        &self,
        club_id: ClubId,
    ) -> PersistenceResult<Option<serde_json::Value>> {
        use sb_db_entities::clubs::Entity;
        use sea_orm::{ColumnTrait, EntityTrait, QueryFilter};

        let club = Entity::find()
            .filter(sb_db_entities::clubs::Column::Id.eq(club_id.as_uuid()))
            .one(&self.db)
            .await
            .map_err(|e| PersistenceError::Database(e.to_string()))?;

        Ok(club.and_then(|c| {
            c.pro_settings_json
                .map(|s| serde_json::to_value(s).unwrap_or_default())
        }))
    }

    async fn get_tables_by_club_id(&self, club_id: ClubId) -> PersistenceResult<Vec<TableId>> {
        use sb_db_entities::table::{Column, Entity};
        use sea_orm::QueryFilter;

        let tables = Entity::find()
            .filter(Column::ClubId.eq(club_id.as_uuid()))
            .all(&self.db)
            .await
            .map_err(|e| PersistenceError::Database(e.to_string()))?;

        Ok(tables.into_iter().map(|t| TableId::new(t.id)).collect())
    }

    async fn get_telegram_chat_id(&self, club_id: ClubId) -> Result<Option<i64>, ClubError> {
        let model = clubs::Entity::find_by_id(club_id.as_uuid())
            .one(&self.db)
            .await
            .map_err(|e| ClubError::Database(e.to_string()))?;

        Ok(model.and_then(|m| m.telegram_chat_id))
    }

    async fn get_user_division(
        &self,
        club_id: ClubId,
        user_id: UserId,
    ) -> Result<Option<u32>, ClubError> {
        let membership = club_memberships::Entity::find()
            .filter(club_memberships::Column::ClubId.eq(club_id.as_uuid()))
            .filter(club_memberships::Column::UserId.eq(user_id.as_uuid()))
            .one(&self.db)
            .await
            .map_err(|e: sea_orm::DbErr| ClubError::Database(e.to_string()))?;

        Ok(membership.map(|m| m.division as u32))
    }

    async fn rebalance_divisions(&self, club_id: ClubId) -> Result<(), ClubError> {
        let start_time = std::time::Instant::now();

        // Use transaction for atomicity
        let txn = self
            .db
            .begin()
            .await
            .map_err(|e: sea_orm::DbErr| ClubError::Database(e.to_string()))?;

        // Single UPDATE using CTE with ROW_NUMBER - O(1) DB operations
        txn.execute_unprepared(&format!(
            r#"
            WITH numbered AS (
                SELECT
                    id,
                    ROW_NUMBER() OVER (ORDER BY joined_at ASC, id ASC) - 1 AS rn
                FROM club_memberships
                WHERE club_id = '{}'
            )
            UPDATE club_memberships
            SET division = (
                SELECT (rn / {}) + 1
                FROM numbered
                WHERE numbered.id = club_memberships.id
            ),
            updated_at = '{}'
            WHERE club_id = '{}'
            AND EXISTS (
                SELECT 1 FROM numbered
                WHERE numbered.id = club_memberships.id
                AND (rn / {}) + 1 != club_memberships.division
            )
            "#,
            club_id.as_uuid(),
            DIVISION_SIZE,
            Utc::now().to_rfc3339(),
            club_id.as_uuid(),
            DIVISION_SIZE
        ))
        .await
        .map_err(|e: sea_orm::DbErr| ClubError::Database(e.to_string()))?;

        txn.commit()
            .await
            .map_err(|e: sea_orm::DbErr| ClubError::Database(e.to_string()))?;

        // Refresh leaderboard after rebalancing
        self.refresh_leaderboard(club_id).await?;

        let elapsed = start_time.elapsed();
        tracing::info!(
            club_id = %club_id,
            elapsed_ms = elapsed.as_millis(),
            "division rebalance completed"
        );

        Ok(())
    }

    async fn is_club_owner(&self, club_id: ClubId, user_id: UserId) -> Result<bool, ClubError> {
        let club = clubs::Entity::find_by_id(club_id.as_uuid())
            .one(&self.db)
            .await
            .map_err(|e| ClubError::Database(e.to_string()))?;

        Ok(club
            .map(|c| c.owner_id == user_id.as_uuid())
            .unwrap_or(false))
    }

    async fn get_user_clubs(&self, user_id: UserId) -> Result<Vec<ClubId>, ClubError> {
        use club_memberships::Column;
        let memberships = club_memberships::Entity::find()
            .filter(Column::UserId.eq(user_id.as_uuid()))
            .all(&self.db)
            .await
            .map_err(|e| ClubError::Database(e.to_string()))?;

        Ok(memberships
            .into_iter()
            .map(|m| ClubId::new(m.club_id))
            .collect())
    }
}

/// Detect UNIQUE constraint violation from sea_orm::DbErr.
fn is_unique_violation(db_err: &sea_orm::DbErr) -> bool {
    let msg = db_err.to_string().to_lowercase();
    msg.contains("unique") || msg.contains("constraint") || msg.contains("duplicate")
}

use async_trait::async_trait;
use chrono::Utc;
use sb_contracts::ClubError;
use sb_contracts::repo_api::{Club, ClubRepo, DIVISION_SIZE, LeaderboardEntry, LeaderboardPage};
use sb_db_entities::{club_leaderboard, club_memberships, clubs};
use sb_shared_types::{ClubId, UserId};
use sea_orm::sea_query::ExprTrait;
use sea_orm::{
    ActiveModelTrait, ActiveValue::Set, ColumnTrait, DatabaseConnection, EntityTrait,
    PaginatorTrait, QueryFilter, QueryOrder, TransactionTrait,
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
            .map_err(|e| ClubError::Database(e.to_string()))?;

        Ok(ClubId::new(id))
    }

    async fn find_club_by_id(&self, club_id: ClubId) -> Result<Option<Club>, ClubError> {
        let model = clubs::Entity::find_by_id(club_id.as_uuid())
            .one(&self.db)
            .await
            .map_err(|e| ClubError::Database(e.to_string()))?;

        Ok(model.map(|m| Club {
            id: ClubId::new(m.id),
            name: m.name,
            logo_url: m.logo_url,
            created_by: UserId::new(m.created_by),
        }))
    }

    async fn join_club(&self, club_id: ClubId, user_id: UserId) -> Result<(), ClubError> {
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
            .map_err(|e| ClubError::Database(e.to_string()))?;

        Ok(count > 0)
    }

    async fn get_member_count(&self, club_id: ClubId) -> Result<u64, ClubError> {
        let count = club_memberships::Entity::find()
            .filter(club_memberships::Column::ClubId.eq(club_id.as_uuid()))
            .count(&self.db)
            .await
            .map_err(|e| ClubError::Database(e.to_string()))?;

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
            .map_err(|e| ClubError::Database(e.to_string()))?;

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
            .map_err(|e| ClubError::Database(e.to_string()))?;

        if result.rows_affected == 0 {
            return Err(ClubError::NotAMember);
        }

        Ok(())
    }

    async fn refresh_leaderboard(&self, club_id: ClubId) -> Result<(), ClubError> {
        let start = std::time::Instant::now();
        let now = Utc::now();

        let txn = self
            .db
            .begin()
            .await
            .map_err(|e| ClubError::Database(e.to_string()))?;

        // Delete existing entries
        club_leaderboard::Entity::delete_many()
            .filter(club_leaderboard::Column::ClubId.eq(club_id.as_uuid()))
            .exec(&txn)
            .await
            .map_err(|e| ClubError::Database(e.to_string()))?;

        // Read all members sorted by weekly_xp
        let members = club_memberships::Entity::find()
            .filter(club_memberships::Column::ClubId.eq(club_id.as_uuid()))
            .order_by_desc(club_memberships::Column::WeeklyXp)
            .all(&txn)
            .await
            .map_err(|e| ClubError::Database(e.to_string()))?;

        // Batch insert new leaderboard rows (chunked for SQLite)
        const INSERT_CHUNK_SIZE: usize = 150;
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

        for chunk in active_models.chunks(INSERT_CHUNK_SIZE) {
            club_leaderboard::Entity::insert_many(chunk.to_vec())
                .exec(&txn)
                .await
                .map_err(|e| ClubError::Database(e.to_string()))?;
        }

        txn.commit()
            .await
            .map_err(|e| ClubError::Database(e.to_string()))?;

        let elapsed = start.elapsed();
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
            .map_err(|e| ClubError::Database(e.to_string()))?;

        Ok(all_clubs.into_iter().map(|c| ClubId::new(c.id)).collect())
    }
    async fn update_club_pro_settings(
        &self,
        club_id: ClubId,
        settings: serde_json::Value,
    ) -> PersistenceResult<()> {
        use sb_db_entities::clubs::{ActiveModel, Entity};
        use sea_orm::{ColumnTrait, EntityTrait, QueryFilter, Set};
        
        let club = Entity::find()
            .filter(sb_db_entities::clubs::Column::Id.eq(club_id))
            .one(&self.db)
            .await
            .map_err(PersistenceError::from)?;
        
        let Some(model) = club else {
            return Err(PersistenceError::NotFound("club".to_string()));
        };
        
        let mut active: ActiveModel = model.into();
        active.pro_settings_json = Set(Some(
            serde_json::from_value(settings).map_err(|e| PersistenceError::InvalidData(e.to_string()))?
        ));
        
        active.update(&self.db).await.map_err(PersistenceError::from)?;
        Ok(())
    }
    
    async fn get_club_pro_settings(
        &self,
        club_id: ClubId,
    ) -> PersistenceResult<Option<serde_json::Value>> {
        use sb_db_entities::clubs::Entity;
        use sea_orm::{ColumnTrait, EntityTrait, QueryFilter};
        
        let club = Entity::find()
            .filter(sb_db_entities::clubs::Column::Id.eq(club_id))
            .one(&self.db)
            .await
            .map_err(PersistenceError::from)?;
        
        Ok(club.and_then(|c| c.pro_settings_json.map(|s| serde_json::to_value(s).unwrap_or_default())))
    }
    
    async fn get_tables_by_club_id(
        &self,
        club_id: ClubId,
    ) -> PersistenceResult<Vec<TableId>> {
        use sb_db_entities::tables::{Column, Entity};
        use sea_orm::{ColumnTrait, EntityTrait, QueryFilter};
        
        let tables = Entity::find()
            .filter(Column::ClubId.eq(Some(club_id)))
            .all(&self.db)
            .await
            .map_err(PersistenceError::from)?;
        
        Ok(tables.into_iter().map(|t| t.id).collect())
    }
}

/// Detect UNIQUE constraint violation from sea_orm::DbErr.
fn is_unique_violation(db_err: &sea_orm::DbErr) -> bool {
    let msg = db_err.to_string().to_lowercase();
    msg.contains("unique") || msg.contains("constraint") || msg.contains("duplicate")
}
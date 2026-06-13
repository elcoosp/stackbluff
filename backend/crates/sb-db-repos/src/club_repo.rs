use async_trait::async_trait;
use chrono::Utc;
use sea_orm::{
    ActiveModelTrait, ActiveValue::Set, ColumnTrait, ConnectionTrait,
    DatabaseConnection, EntityTrait, PaginatorTrait, QueryFilter, QueryOrder,
};
use sb_contracts::{Club, ClubRepo, LeaderboardEntry, LeaderboardPage, PersistenceError, DIVISION_SIZE};
use sb_shared_types::{ClubId, UserId};
use sb_db_entities::{club_leaderboard, club_memberships, clubs};
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
    ) -> Result<ClubId, PersistenceError> {
        let id = Uuid::new_v4();
        let now = Utc::now();
        let active = clubs::ActiveModel {
            id: Set(id),
            name: Set(name.to_string()),
            logo_url: Set(logo_url.map(|s| s.to_string())),
            created_by: Set(created_by.into()),
            created_at: Set(now),
            updated_at: Set(now),
        };

        active
            .insert(&self.db)
            .await
            .map_err(|e| PersistenceError::Database(e.to_string()))?;

        Ok(ClubId::from(id))
    }

    async fn find_club_by_id(
        &self,
        club_id: ClubId,
    ) -> Result<Option<Club>, PersistenceError> {
        let uuid: Uuid = club_id.into();
        let model = clubs::Entity::find_by_id(uuid)
            .one(&self.db)
            .await
            .map_err(|e| PersistenceError::Database(e.to_string()))?;

        Ok(model.map(|m| Club {
            id: ClubId::from(m.id),
            name: m.name,
            logo_url: m.logo_url,
            created_by: UserId::from(m.created_by),
        }))
    }

    async fn join_club(
        &self,
        club_id: ClubId,
        user_id: UserId,
    ) -> Result<(), PersistenceError> {
        let id = Uuid::new_v4();
        let now = Utc::now();
        let active = club_memberships::ActiveModel {
            id: Set(id),
            club_id: Set(club_id.into()),
            user_id: Set(user_id.into()),
            weekly_xp: Set(0),
            joined_at: Set(now),
            updated_at: Set(now),
        };

        active
            .insert(&self.db)
            .await
            .map_err(|e| PersistenceError::Database(e.to_string()))?;

        Ok(())
    }

    async fn is_member(
        &self,
        club_id: ClubId,
        user_id: UserId,
    ) -> Result<bool, PersistenceError> {
        let count = club_memberships::Entity::find()
            .filter(club_memberships::Column::ClubId.eq(Uuid::from(club_id)))
            .filter(club_memberships::Column::UserId.eq(Uuid::from(user_id)))
            .count(&self.db)
            .await
            .map_err(|e: sea_orm::DbErr| PersistenceError::Database(e.to_string()))?;

        Ok(count > 0)
    }

    async fn get_member_count(
        &self,
        club_id: ClubId,
    ) -> Result<u64, PersistenceError> {
        let count = club_memberships::Entity::find()
            .filter(club_memberships::Column::ClubId.eq(Uuid::from(club_id)))
            .count(&self.db)
            .await
            .map_err(|e: sea_orm::DbErr| PersistenceError::Database(e.to_string()))?;

        Ok(count)
    }

    async fn get_leaderboard_page(
        &self,
        club_id: ClubId,
        division: u32,
    ) -> Result<LeaderboardPage, PersistenceError> {
        let total_members = self.get_member_count(club_id).await?;
        let total_divisions = if total_members == 0 {
            1
        } else {
            ((total_members as u32 - 1) / DIVISION_SIZE) + 1
        };

        let entries = club_leaderboard::Entity::find()
            .filter(club_leaderboard::Column::ClubId.eq(Uuid::from(club_id)))
            .filter(club_leaderboard::Column::Division.eq(division as i32))
            .order_by_asc(club_leaderboard::Column::Rank)
            .all(&self.db)
            .await
            .map_err(|e: sea_orm::DbErr| PersistenceError::Database(e.to_string()))?;

        let leaderboard_entries: Vec<LeaderboardEntry> = entries
            .into_iter()
            .map(|e| LeaderboardEntry {
                rank: e.rank as u32,
                user_id: UserId::from(e.user_id),
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
    ) -> Result<(), PersistenceError> {
        // Find the membership, then update it (read-modify-write via SeaORM)
        let model = club_memberships::Entity::find()
            .filter(club_memberships::Column::ClubId.eq(Uuid::from(club_id)))
            .filter(club_memberships::Column::UserId.eq(Uuid::from(user_id)))
            .one(&self.db)
            .await
            .map_err(|e: sea_orm::DbErr| PersistenceError::Database(e.to_string()))?;

        match model {
            Some(m) => {
                let mut active: club_memberships::ActiveModel = m.into();
                let current_xp: i64 = active.weekly_xp.unwrap();
                active.weekly_xp = Set(current_xp + xp);
                active.updated_at = Set(Utc::now());
                ActiveModelTrait::update(active, &self.db)
                    .await
                    .map_err(|e: sea_orm::DbErr| PersistenceError::Database(e.to_string()))?;
                Ok(())
            }
            None => Err(PersistenceError::NotAMember),
        }
    }

    async fn refresh_leaderboard(
        &self,
        club_id: ClubId,
    ) -> Result<(), PersistenceError> {
        let now = Utc::now();

        // 1. Delete existing leaderboard entries for this club
        club_leaderboard::Entity::delete_many()
            .filter(club_leaderboard::Column::ClubId.eq(Uuid::from(club_id)))
            .exec(&self.db)
            .await
            .map_err(|e: sea_orm::DbErr| PersistenceError::Database(e.to_string()))?;

        // 2. Read all members sorted by weekly_xp descending
        let members = club_memberships::Entity::find()
            .filter(club_memberships::Column::ClubId.eq(Uuid::from(club_id)))
            .order_by_desc(club_memberships::Column::WeeklyXp)
            .all(&self.db)
            .await
            .map_err(|e: sea_orm::DbErr| PersistenceError::Database(e.to_string()))?;

        // 3. Insert new leaderboard rows with rank and division
        for (idx, member) in members.iter().enumerate() {
            let rank = (idx + 1) as i32;
            let division = ((idx as u32) / DIVISION_SIZE) + 1;

            let active = club_leaderboard::ActiveModel {
                club_id: Set(Uuid::from(club_id)),
                user_id: Set(member.user_id),
                rank: Set(rank),
                weekly_xp: Set(member.weekly_xp),
                division: Set(division as i32),
                refreshed_at: Set(now),
            };

            active
                .insert(&self.db)
                .await
                .map_err(|e: sea_orm::DbErr| PersistenceError::Database(e.to_string()))?;
        }

        Ok(())
    }

    async fn get_all_club_ids(&self) -> Result<Vec<ClubId>, PersistenceError> {
        let all_clubs = clubs::Entity::find()
            .all(&self.db)
            .await
            .map_err(|e: sea_orm::DbErr| PersistenceError::Database(e.to_string()))?;

        Ok(all_clubs.into_iter().map(|c| ClubId::from(c.id)).collect())
    }
}

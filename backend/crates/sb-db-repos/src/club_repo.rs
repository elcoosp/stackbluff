use async_trait::async_trait;
use chrono::Utc;
use sb_contracts::ClubError;
use sb_contracts::repo_api::{Club, ClubRepo, DIVISION_SIZE, LeaderboardEntry, LeaderboardPage, PersistenceError, PersistenceResult};
use sb_db_entities::{club_leaderboard, club_memberships, clubs};
use sb_shared_types::{ClubId, UserId};
use sea_orm::sea_query::ExprTrait;
use sea_orm::{
    ActiveModelTrait, ActiveValue::Set, ColumnTrait, DatabaseConnection, EntityTrait, QueryFilter, QueryOrder, QuerySelect,
};
use std::sync::Arc;
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
    async fn find_by_id(&self, club_id: ClubId) -> PersistenceResult<Club> {
        use sb_db_entities::clubs::{Entity, Model};
        use sea_orm::{ColumnTrait, EntityTrait, QueryFilter};

        let model = Entity::find()
            .filter(sb_db_entities::clubs::Column::Id.eq(club_id))
            .one(&self.db)
            .await
            .map_err(PersistenceError::from)?;

        model.map(|m| Club {
            id: m.id,
            name: m.name,
            owner_id: m.owner_id,
        }).ok_or(PersistenceError::NotFound("club".to_string()))
    }

    async fn create_club(&self, owner_id: UserId, name: String) -> PersistenceResult<Club> {
        use sb_db_entities::clubs::{ActiveModel, Entity};
        use sea_orm::{ActiveModelTrait, Set};
        use chrono::Utc;

        let id = Uuid::new_v4();
        let active = ActiveModel {
            id: Set(id),
            name: Set(name),
            owner_id: Set(owner_id),
            created_at: Set(Utc::now().into()),
            updated_at: Set(Utc::now().into()),
            pro_settings_json: Set(None),
        };

        active.insert(&self.db).await.map_err(PersistenceError::from)?;

        Ok(Club {
            id,
            name: active.name.unwrap(),
            owner_id: active.owner_id.unwrap(),
        })
    }

    async fn get_leaderboard(
        &self,
        club_id: ClubId,
        page: u64,
    ) -> PersistenceResult<LeaderboardPage> {
        use sb_db_entities::club_leaderboard::{Column, Entity};
        use sea_orm::{ColumnTrait, EntityTrait, QueryFilter, QueryOrder, QuerySelect};

        let entries = Entity::find()
            .filter(Column::ClubId.eq(club_id))
            .order_by_desc(Column::Score)
            .offset(page * DIVISION_SIZE)
            .limit(DIVISION_SIZE)
            .all(&self.db)
            .await
            .map_err(PersistenceError::from)?;

        let total = Entity::find()
            .filter(Column::ClubId.eq(club_id))
            .count(&self.db)
            .await
            .map_err(PersistenceError::from)?;

        Ok(LeaderboardPage {
            entries: entries.into_iter().map(|e| LeaderboardEntry {
                user_id: e.user_id,
                score: e.score,
            }).collect(),
            total,
        })
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

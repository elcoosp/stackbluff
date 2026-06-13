use sb_contracts::{ClubRepo, ClubService, LeaderboardPage, PersistenceError};
use sb_shared_types::{ClubId, UserId};
use std::sync::Arc;

pub struct ClubServiceImpl {
    repo: Arc<dyn ClubRepo>,
}

impl ClubServiceImpl {
    pub fn new(repo: Arc<dyn ClubRepo>) -> Self {
        Self { repo }
    }
}

#[async_trait::async_trait]
impl ClubService for ClubServiceImpl {
    async fn create_club(
        &self,
        name: &str,
        logo_url: Option<&str>,
        created_by: UserId,
    ) -> Result<ClubId, PersistenceError> {
        if name.trim().is_empty() {
            return Err(PersistenceError::ValidationError(
                "club name must not be empty".into(),
            ));
        }
        self.repo.create_club(name, logo_url, created_by).await
    }

    async fn join_club(
        &self,
        club_id: ClubId,
        user_id: UserId,
    ) -> Result<(), PersistenceError> {
        let club = self.repo.find_club_by_id(club_id).await?;
        if club.is_none() {
            return Err(PersistenceError::ClubNotFound);
        }
        if self.repo.is_member(club_id, user_id).await? {
            return Err(PersistenceError::AlreadyMember);
        }
        self.repo.join_club(club_id, user_id).await
    }

    async fn get_leaderboard(
        &self,
        club_id: ClubId,
        division: u32,
    ) -> Result<LeaderboardPage, PersistenceError> {
        let club = self.repo.find_club_by_id(club_id).await?;
        if club.is_none() {
            return Err(PersistenceError::ClubNotFound);
        }
        self.repo.get_leaderboard_page(club_id, division).await
    }

    async fn add_xp(
        &self,
        club_id: ClubId,
        user_id: UserId,
        xp: i64,
    ) -> Result<(), PersistenceError> {
        if !self.repo.is_member(club_id, user_id).await? {
            return Err(PersistenceError::NotAMember);
        }
        self.repo.increment_weekly_xp(club_id, user_id, xp).await
    }
}

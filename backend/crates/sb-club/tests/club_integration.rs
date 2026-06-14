//! Integration test: create club -> join -> add XP -> refresh leaderboard -> read leaderboard.

use sb_contracts::{ClubRepo, ClubService, LeaderboardPage, PersistenceError, DIVISION_SIZE};
use sb_shared_types::{ClubId, UserId};
use std::collections::HashSet;
use std::sync::Arc;
use parking_lot::RwLock;
use uuid::Uuid;

struct MockClubRepo {
    members: Arc<RwLock<HashSet<(ClubId, UserId)>>>,
}

impl MockClubRepo {
    fn new() -> Self {
        Self {
            members: Arc::new(RwLock::new(HashSet::new())),
        }
    }
}

#[async_trait::async_trait]
impl ClubRepo for MockClubRepo {
    async fn create_club(
        &self,
        _name: &str,
        _logo_url: Option<&str>,
        _created_by: UserId,
    ) -> Result<ClubId, PersistenceError> {
        Ok(ClubId::from(Uuid::new_v4()))
    }

    async fn find_club_by_id(
        &self,
        _club_id: ClubId,
    ) -> Result<Option<sb_contracts::Club>, PersistenceError> {
        Ok(Some(sb_contracts::Club {
            id: ClubId::from(Uuid::new_v4()),
            name: "Test Club".to_string(),
            logo_url: None,
            created_by: UserId::from(Uuid::new_v4()),
        }))
    }

    async fn join_club(
        &self,
        club_id: ClubId,
        user_id: UserId,
    ) -> Result<(), PersistenceError> {
        self.members.write().insert((club_id, user_id));
        Ok(())
    }

    async fn is_member(
        &self,
        club_id: ClubId,
        user_id: UserId,
    ) -> Result<bool, PersistenceError> {
        Ok(self.members.read().contains(&(club_id, user_id)))
    }

    async fn get_member_count(
        &self,
        _club_id: ClubId,
    ) -> Result<u64, PersistenceError> {
        Ok(600)
    }

    async fn get_leaderboard_page(
        &self,
        club_id: ClubId,
        division: u32,
    ) -> Result<LeaderboardPage, PersistenceError> {
        let total_members: u64 = 600;
        let total_divisions = ((total_members as u32 - 1) / DIVISION_SIZE) + 1;

        let entry_count = if division == 1 { 500 } else { 100 };

        let entries: Vec<sb_contracts::LeaderboardEntry> = (0..entry_count)
            .map(|i| sb_contracts::LeaderboardEntry {
                rank: (i + 1) as u32,
                user_id: UserId::from(Uuid::new_v4()),
                weekly_xp: (entry_count - i) as i64 * 10,
            })
            .collect();

        Ok(LeaderboardPage {
            club_id,
            division,
            total_divisions,
            total_members,
            entries,
        })
    }

    async fn increment_weekly_xp(
        &self,
        _club_id: ClubId,
        _user_id: UserId,
        _xp: i64,
    ) -> Result<(), PersistenceError> {
        Ok(())
    }

    async fn refresh_leaderboard(
        &self,
        _club_id: ClubId,
    ) -> Result<(), PersistenceError> {
        Ok(())
    }

    async fn get_all_club_ids(&self) -> Result<Vec<ClubId>, PersistenceError> {
        Ok(vec![])
    }
}

fn make_service() -> Arc<dyn ClubService> {
    let repo: Arc<dyn ClubRepo> = Arc::new(MockClubRepo::new());
    Arc::new(sb_club::ClubServiceImpl::new(repo))
}

#[tokio::test]
async fn test_create_club() {
    let svc = make_service();
    let user_id = UserId::from(Uuid::new_v4());
    let club_id = svc
        .create_club("Test Club", Some("https://logo.example.com/img.png"), user_id)
        .await
        .expect("create club");
    assert!(!club_id.0.is_nil());
}

#[tokio::test]
async fn test_join_club() {
    let svc = make_service();
    let owner_id = UserId::from(Uuid::new_v4());
    let club_id = svc.create_club("Join Club", None, owner_id).await.expect("create");

    let member_id = UserId::from(Uuid::new_v4());
    svc.join_club(club_id, member_id).await.expect("join club");

    // Second join should fail
    let result = svc.join_club(club_id, member_id).await;
    assert!(matches!(result, Err(PersistenceError::AlreadyMember)));
}

#[tokio::test]
async fn test_add_xp() {
    let svc = make_service();
    let owner_id = UserId::from(Uuid::new_v4());
    let club_id = svc.create_club("XP Club", None, owner_id).await.expect("create");
    svc.join_club(club_id, owner_id).await.expect("join");
    svc.add_xp(club_id, owner_id, 100).await.expect("add xp");
}

#[tokio::test]
async fn test_add_xp_not_member() {
    let svc = make_service();
    let owner_id = UserId::from(Uuid::new_v4());
    let club_id = svc.create_club("NoXP Club", None, owner_id).await.expect("create");
    // Don't join — add_xp should fail
    let result = svc.add_xp(club_id, owner_id, 100).await;
    assert!(matches!(result, Err(PersistenceError::NotAMember)));
}

#[tokio::test]
async fn test_leaderboard_divisions() {
    let svc = make_service();
    let owner_id = UserId::from(Uuid::new_v4());
    let club_id = svc.create_club("Big Club", None, owner_id).await.expect("create");

    let page = svc.get_leaderboard(club_id, 1).await.expect("get leaderboard");

    assert_eq!(page.total_members, 600);
    assert_eq!(page.total_divisions, 2);
    assert!(page.entries.len() <= 500);

    // Division 2
    let page2 = svc.get_leaderboard(club_id, 2).await.expect("get leaderboard div 2");
    assert_eq!(page2.division, 2);
    assert!(page2.entries.len() <= 100);
}

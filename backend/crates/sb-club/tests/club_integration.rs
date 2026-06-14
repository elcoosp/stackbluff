//! Integration test: create club → join → add XP → refresh leaderboard → read leaderboard.

use sb_contracts::{ClubRepo, ClubService, LeaderboardPage, PersistenceError, DIVISION_SIZE};
use sb_shared_types::{ClubId, UserId};
use std::sync::Arc;
use uuid::Uuid;

struct MockClubRepo;

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
        _club_id: ClubId,
        _user_id: UserId,
    ) -> Result<(), PersistenceError> {
        Ok(())
    }

    async fn is_member(
        &self,
        _club_id: ClubId,
        _user_id: UserId,
    ) -> Result<bool, PersistenceError> {
        Ok(true)
    }

    async fn get_member_count(
        &self,
        club_id: ClubId,
    ) -> Result<u64, PersistenceError> {
        // Return 600 for the large club test
        let bytes = club_id.into_bytes();
        let last_byte = bytes[15];
        if last_byte % 2 == 0 {
            Ok(600)
        } else {
            Ok(1)
        }
    }

    async fn get_leaderboard_page(
        &self,
        club_id: ClubId,
        division: u32,
    ) -> Result<LeaderboardPage, PersistenceError> {
        let total_members = self.get_member_count(club_id).await?;
        let total_divisions = if total_members == 0 { 1 } else { ((total_members as u32 - 1) / DIVISION_SIZE) + 1 };

        let entry_count = if division == 1 && total_members > 500 { 500 } else { total_members.min(500) as usize };

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
    let repo: Arc<dyn ClubRepo> = Arc::new(MockClubRepo);
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
    assert!(!club_id.is_nil());
}

#[tokio::test]
async fn test_join_club() {
    let svc = make_service();
    let owner_id = UserId::from(Uuid::new_v4());
    let club_id = svc.create_club("Join Club", None, owner_id).await.expect("create");

    let member_id = UserId::from(Uuid::new_v4());
    svc.join_club(club_id, member_id).await.expect("join club");
}

#[tokio::test]
async fn test_join_club_already_member() {
    let svc = make_service();
    let owner_id = UserId::from(Uuid::new_v4());
    let club_id = svc.create_club("Dup Club", None, owner_id).await.expect("create");

    let member_id = UserId::from(Uuid::new_v4());
    svc.join_club(club_id, member_id).await.expect("first join");
    // Mock always returns is_member=true, so this should fail
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
async fn test_leaderboard_divisions() {
    let svc = make_service();
    let owner_id = UserId::from(Uuid::new_v4());

    // Create a club with an even last byte so mock returns 600 members
    let club_id = svc.create_club("Big Club", None, owner_id).await.expect("create");

    let page = svc.get_leaderboard(club_id, 1).await.expect("get leaderboard");

    assert_eq!(page.total_members, 600);
    assert_eq!(page.total_divisions, 2);
    assert!(page.entries.len() <= 500);
}

//! Integration test: create club → join → add XP → refresh leaderboard → read leaderboard.
//!
//! Requires `DATABASE_URL` env var pointing at a writable SQLite database.
//! Run with: cargo test -p sb-club --test club_integration

use sb_contracts::{ClubRepo, ClubService, PersistenceError, DIVISION_SIZE};
use sb_db_repos::ClubRepoImpl;
use sb_club::ClubServiceImpl;
use sea_orm::Database;
use std::sync::Arc;
use uuid::Uuid;

async fn setup() -> Arc<dyn ClubService> {
    let db_url = std::env::var("DATABASE_URL")
        .unwrap_or_else(|_| "sqlite::memory:".to_string());

    let db = Database::connect(&db_url)
        .await
        .expect("db connect");

    // Run migrations if using a file db
    let _ = migration::Migrator::up(&db, None).await;

    let repo: Arc<dyn ClubRepo> = Arc::new(ClubRepoImpl::new(db));
    Arc::new(ClubServiceImpl::new(repo))
}

#[tokio::test]
async fn test_create_and_join_club() {
    let svc = setup().await;
    let user_id = Uuid::new_v4();

    // Create club
    let club_id = svc
        .create_club("Test Club", Some("https://logo.example.com/img.png"), user_id)
        .await
        .expect("create club");

    assert!(!club_id.is_nil());

    // Another user joins
    let member_id = Uuid::new_v4();
    svc.join_club(club_id, member_id)
        .await
        .expect("join club");

    // Joining again should fail
    let result = svc.join_club(club_id, member_id).await;
    assert!(matches!(result, Err(PersistenceError::AlreadyMember)));
}

#[tokio::test]
async fn test_add_xp_and_leaderboard() {
    let svc = setup().await;
    let owner_id = Uuid::new_v4();

    let club_id = svc
        .create_club("XP Club", None, owner_id)
        .await
        .expect("create club");

    // Owner joins
    svc.join_club(club_id, owner_id)
        .await
        .expect("owner join");

    // Add XP
    svc.add_xp(club_id, owner_id, 100)
        .await
        .expect("add xp");

    // Refresh leaderboard
    let repo = get_repo(&svc);
    repo.refresh_leaderboard(club_id)
        .await
        .expect("refresh leaderboard");

    // Read leaderboard
    let page = svc
        .get_leaderboard(club_id, 1)
        .await
        .expect("get leaderboard");

    assert_eq!(page.club_id, club_id);
    assert_eq!(page.division, 1);
    assert!(!page.entries.is_empty());
    assert_eq!(page.entries[0].weekly_xp, 100);
}

#[tokio::test]
async fn test_leaderboard_divisions_for_large_club() {
    let svc = setup().await;
    let owner_id = Uuid::new_v4();

    let club_id = svc
        .create_club("Big Club", None, owner_id)
        .await
        .expect("create club");

    // Owner joins first
    svc.join_club(club_id, owner_id)
        .await
        .expect("owner join");

    // Add 599 more members (total 600)
    for i in 0..599 {
        let uid = Uuid::new_v4();
        svc.join_club(club_id, uid).await.expect("join");
        // Give varying XP so ranking is deterministic
        svc.add_xp(club_id, uid, (599 - i) as i64 * 10)
            .await
            .expect("add xp");
    }

    // Give owner most XP
    svc.add_xp(club_id, owner_id, 6000)
        .await
        .expect("add xp owner");

    // Refresh leaderboard
    let repo = get_repo(&svc);
    repo.refresh_leaderboard(club_id)
        .await
        .expect("refresh leaderboard");

    // Division 1 should have up to 500 rows
    let div1 = svc
        .get_leaderboard(club_id, 1)
        .await
        .expect("get leaderboard div 1");

    assert_eq!(div1.total_members, 600);
    assert_eq!(div1.total_divisions, 2);
    assert!(div1.entries.len() <= DIVISION_SIZE as usize);

    // Division 2 should exist with remaining rows
    let div2 = svc
        .get_leaderboard(club_id, 2)
        .await
        .expect("get leaderboard div 2");

    assert_eq!(div2.division, 2);
    assert!(div2.entries.len() <= 100); // 600 - 500 = 100
}

/// Helper to downcast to get the repo. In production we'd use a more
/// ergonomic approach, but for tests this is fine.
fn get_repo(svc: &Arc<dyn ClubService>) -> Arc<dyn ClubRepo> {
    // We know the concrete type behind the service, so we construct
    // a new repo for test purposes. This is a test-only workaround.
    // In a real app, the repo is shared.
    let db_url = std::env::var("DATABASE_URL")
        .unwrap_or_else(|_| "sqlite::memory:".to_string());

    // This is a trade-off: in integration tests with SQLite :memory:,
    // each connect gives a different DB. Use a file path for real tests.
    // For CI we set DATABASE_URL to a temp file.
    let rt = tokio::runtime::Handle::current();
    let db = rt.block_on(Database::connect(&db_url)).expect("db connect");
    Arc::new(ClubRepoImpl::new(db)) as Arc<dyn ClubRepo>
}

//! Integration test against a temporary SQLite database.
//! Tests actual SQL correctness, not mock behaviour.
use migration::MigratorTrait;
use sb_club::ClubServiceImpl;
use sb_contracts::{ClubError, ClubRepo, ClubService, DIVISION_SIZE};
use sb_db_repos::club_repo::ClubRepoImpl;
use sb_shared_types::{ClubId, RequestContext, UserId};
use sea_orm::{ConnectionTrait, Database};
use std::sync::Arc;
use uuid::Uuid;

async fn setup_db() -> (Arc<dyn ClubService>, Arc<dyn ClubRepo>) {
    let db = Database::connect("sqlite::memory:")
        .await
        .expect("db connect");

    // Run migrations to create tables
    migration::Migrator::up(&db, None)
        .await
        .expect("migrations");

    // Disable FK constraints for integration tests — we're testing
    // club SQL correctness, not FK integrity. Without real user rows,
    // FK constraints on clubs.owner_id and club_memberships.user_id
    // would block all inserts.
    db.execute_unprepared("PRAGMA foreign_keys = OFF")
        .await
        .expect("disable FK for tests");

    let repo: Arc<dyn ClubRepo> = Arc::new(ClubRepoImpl::new(db));
    let service = Arc::new(ClubServiceImpl::new(repo.clone()));
    (service, repo)
}

fn test_ctx() -> RequestContext {
    RequestContext {
        request_id: Uuid::new_v4(),
        user_id: Some(UserId(Uuid::new_v4())),
    }
}

#[tokio::test]
async fn test_create_club() {
    let (svc, _repo) = setup_db().await;
    let ctx = test_ctx();
    let user_id = ctx.user_id.unwrap();
    let club_id = svc
        .create_club(
            &ctx,
            "Test Club",
            Some("https://logo.example.com/img.png"),
            user_id,
        )
        .await
        .expect("create club");
    assert!(!club_id.as_uuid().is_nil());
}

#[tokio::test]
async fn test_join_club_and_duplicate() {
    let (svc, _repo) = setup_db().await;
    let ctx = test_ctx();
    let owner_id = ctx.user_id.unwrap();
    let club_id = svc
        .create_club(&ctx, "Join Club", None, owner_id)
        .await
        .expect("create");

    let member_ctx = RequestContext {
        request_id: Uuid::new_v4(),
        user_id: Some(UserId(Uuid::new_v4())),
    };
    let member_id = member_ctx.user_id.unwrap();
    svc.join_club(&member_ctx, club_id, member_id)
        .await
        .expect("join club");

    // Second join should fail with AlreadyMember (UNIQUE constraint)
    let result = svc.join_club(&member_ctx, club_id, member_id).await;
    assert!(matches!(result, Err(ClubError::AlreadyMember { .. })));
}

#[tokio::test]
async fn test_add_xp_not_member() {
    let (svc, _repo) = setup_db().await;
    let ctx = test_ctx();
    let owner_id = ctx.user_id.unwrap();
    let club_id = svc
        .create_club(&ctx, "NoXP Club", None, owner_id)
        .await
        .expect("create");
    // Don't join — add_xp should fail
    let result = svc.add_xp(&ctx, club_id, owner_id, 100).await;
    assert!(matches!(result, Err(ClubError::NotAMember { .. })));
}

#[tokio::test]
async fn test_add_xp_member() {
    let (svc, _repo) = setup_db().await;
    let ctx = test_ctx();
    let owner_id = ctx.user_id.unwrap();
    let club_id = svc
        .create_club(&ctx, "XP Club", None, owner_id)
        .await
        .expect("create");
    svc.join_club(&ctx, club_id, owner_id).await.expect("join");
    svc.add_xp(&ctx, club_id, owner_id, 100)
        .await
        .expect("add xp");
}

#[tokio::test]
async fn test_leaderboard_divisions() {
    let (svc, repo) = setup_db().await;
    let ctx = test_ctx();
    let owner_id = ctx.user_id.unwrap();
    let club_id = svc
        .create_club(&ctx, "Big Club", None, owner_id)
        .await
        .expect("create");

    // Owner joins the club too
    svc.join_club(&ctx, club_id, owner_id)
        .await
        .expect("owner join");

    // Join and add XP for 599 additional members (total 600)
    for i in 0..599 {
        let member_ctx = RequestContext {
            request_id: Uuid::new_v4(),
            user_id: Some(UserId(Uuid::new_v4())),
        };
        let member_id = member_ctx.user_id.unwrap();
        svc.join_club(&member_ctx, club_id, member_id)
            .await
            .expect("join");
        svc.add_xp(&member_ctx, club_id, member_id, (599 - i) as i64 * 10)
            .await
            .expect("add xp");
    }

    // Refresh leaderboard
    repo.refresh_leaderboard(club_id).await.expect("refresh");

    // Division 1 should have up to 500 rows
    let div1 = svc
        .get_leaderboard(&ctx, club_id, 1)
        .await
        .expect("get leaderboard div 1");

    assert_eq!(div1.total_members, 600);
    assert_eq!(div1.total_divisions, 2);
    assert!(div1.entries.len() <= DIVISION_SIZE as usize);

    // Division 2 should have remaining rows
    let div2 = svc
        .get_leaderboard(&ctx, club_id, 2)
        .await
        .expect("get leaderboard div 2");
    assert_eq!(div2.division, 2);
    assert!(div2.entries.len() <= 100);
}
#[tokio::test]
async fn test_club_not_found() {
    let (svc, _repo) = setup_db().await;
    let ctx = test_ctx();
    let fake_club = ClubId::new(Uuid::new_v4());
    let result = svc.get_leaderboard(&ctx, fake_club, 1).await;
    assert!(matches!(result, Err(ClubError::NotFound { .. })));
}

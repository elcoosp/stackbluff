//! Integration test against a temporary SQLite database.
//! Tests actual SQL correctness, not mock behaviour.

use migration::Migrator;
use sb_club::ClubServiceImpl;
use sb_contracts::{ClubError, ClubRepo, ClubService, DIVISION_SIZE};
use sb_db_entities::user::ActiveModel as UserActiveModel;
use sb_db_repos::club_repo::ClubRepoImpl;
use sb_shared_types::{ClubId, RequestContext, UserId};
use sea_orm::{ActiveModelTrait, Database};
use sea_orm_migration::migrator::MigratorTrait;
use std::sync::Arc;
use uuid::Uuid;

async fn setup_db() -> (
    Arc<dyn ClubService>,
    Arc<dyn ClubRepo>,
    sea_orm::DatabaseConnection,
) {
    let db = Database::connect("sqlite::memory:")
        .await
        .expect("db connect");

    // Run migrations
    Migrator::up(&db, None).await.expect("migrations");

    let repo: Arc<dyn ClubRepo> = Arc::new(ClubRepoImpl::new(db.clone()));
    let service = Arc::new(ClubServiceImpl::new(repo.clone()));
    (service, repo, db)
}

async fn ensure_user(db: &sea_orm::DatabaseConnection, user_id: UserId) {
    use sea_orm::ActiveValue::Set;

    let new_user = UserActiveModel {
        id: Set(user_id.as_uuid()),
        display_name: Set(format!("test_{}", &user_id.as_uuid().to_string()[..8])),
        chip_balance: Set(0),
        streak_count: Set(0),
        created_at: Set(chrono::Utc::now()),
        updated_at: Set(chrono::Utc::now()),
        platform: Set(sb_db_entities::enums::Platform::Telegram),
        password_hash: Set(None),
        registration_order: Set(Some(0)),
        ..Default::default()
    };

    new_user.insert(db).await.expect("insert test user");
}

fn test_ctx() -> RequestContext {
    RequestContext {
        request_id: Uuid::new_v4(),
        user_id: Some(UserId(Uuid::new_v4())),
        ip: "127.0.0.1".to_string(),
    }
}

#[tokio::test]
async fn test_create_club() {
    let (svc, _repo, db) = setup_db().await;
    let ctx = test_ctx();
    let user_id = ctx.user_id.unwrap();
    ensure_user(&db, user_id).await;
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
    let (svc, _repo, db) = setup_db().await;
    let ctx = test_ctx();
    let owner_id = ctx.user_id.unwrap();
    ensure_user(&db, owner_id).await;
    let club_id = svc
        .create_club(&ctx, "Join Club", None, owner_id)
        .await
        .expect("create");

    let member_ctx = RequestContext {
        request_id: Uuid::new_v4(),
        user_id: Some(UserId(Uuid::new_v4())),
        ip: "127.0.0.1".to_string(),
    };
    let member_id = member_ctx.user_id.unwrap();
    ensure_user(&db, member_id).await;
    svc.join_club(&member_ctx, club_id, member_id)
        .await
        .expect("join club");

    let result = svc.join_club(&member_ctx, club_id, member_id).await;
    assert!(matches!(result, Err(ClubError::AlreadyMember)));
}

#[tokio::test]
async fn test_add_xp_not_member() {
    let (svc, _repo, db) = setup_db().await;
    let ctx = test_ctx();
    let owner_id = ctx.user_id.unwrap();
    ensure_user(&db, owner_id).await;
    let club_id = svc
        .create_club(&ctx, "NoXP Club", None, owner_id)
        .await
        .expect("create");
    let result = svc.add_xp(&ctx, club_id, owner_id, 100).await;
    assert!(matches!(result, Err(ClubError::NotAMember)));
}

#[tokio::test]
async fn test_add_xp_member() {
    let (svc, _repo, db) = setup_db().await;
    let ctx = test_ctx();
    let owner_id = ctx.user_id.unwrap();
    ensure_user(&db, owner_id).await;
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
    let (svc, repo, db) = setup_db().await;
    let ctx = test_ctx();
    let owner_id = ctx.user_id.unwrap();
    ensure_user(&db, owner_id).await;
    let club_id = svc
        .create_club(&ctx, "Big Club", None, owner_id)
        .await
        .expect("create");

    svc.join_club(&ctx, club_id, owner_id)
        .await
        .expect("owner join");

    for i in 0..599 {
        let member_ctx = RequestContext {
            request_id: Uuid::new_v4(),
            user_id: Some(UserId(Uuid::new_v4())),
            ip: "127.0.0.1".to_string(),
        };
        let member_id = member_ctx.user_id.unwrap();
        ensure_user(&db, member_id).await;
        svc.join_club(&member_ctx, club_id, member_id)
            .await
            .expect("join");
        svc.add_xp(&member_ctx, club_id, member_id, (599 - i) as i64 * 10)
            .await
            .expect("add xp");
    }

    repo.refresh_leaderboard(club_id).await.expect("refresh");

    let div1 = svc
        .get_leaderboard(&ctx, club_id, 1)
        .await
        .expect("get leaderboard div 1");

    assert_eq!(div1.total_members, 600);
    assert_eq!(div1.total_divisions, 2);
    assert!(div1.entries.len() <= DIVISION_SIZE as usize);

    let div2 = svc
        .get_leaderboard(&ctx, club_id, 2)
        .await
        .expect("get leaderboard div 2");
    assert_eq!(div2.division, 2);
    assert!(div2.entries.len() <= 100);
}

#[tokio::test]
async fn test_club_not_found() {
    let (svc, _repo, _db) = setup_db().await;
    let ctx = test_ctx();
    let fake_club = ClubId::new(Uuid::new_v4());
    let result = svc.get_leaderboard(&ctx, fake_club, 1).await;
    assert!(matches!(result, Err(ClubError::NotFound)));
}

#[tokio::test]
async fn test_get_user_division() {
    let (svc, _repo, db) = setup_db().await;
    let ctx = test_ctx();
    let owner_id = ctx.user_id.unwrap();
    ensure_user(&db, owner_id).await;
    let club_id = svc
        .create_club(&ctx, "Division Test Club", None, owner_id)
        .await
        .expect("create");

    // Owner joins (should be division 1)
    svc.join_club(&ctx, club_id, owner_id)
        .await
        .expect("owner join");

    let division = svc
        .get_user_division(&ctx, club_id, owner_id)
        .await
        .expect("get division");
    assert_eq!(division, Some(1));

    // Add 499 more members to fill division 1
    for _i in 0..499 {
        let member_ctx = RequestContext {
            request_id: Uuid::new_v4(),
            user_id: Some(UserId(Uuid::new_v4())),
            ip: "127.0.0.1".to_string(),
        };
        let member_id = member_ctx.user_id.unwrap();
        ensure_user(&db, member_id).await;
        svc.join_club(&member_ctx, club_id, member_id)
            .await
            .expect("join");
    }

    // 501st member should be in division 2
    let member_501_ctx = RequestContext {
        request_id: Uuid::new_v4(),
        user_id: Some(UserId(Uuid::new_v4())),
        ip: "127.0.0.1".to_string(),
    };
    let member_501_id = member_501_ctx.user_id.unwrap();
    ensure_user(&db, member_501_id).await;
    svc.join_club(&member_501_ctx, club_id, member_501_id)
        .await
        .expect("join 501st");

    let division_501 = svc
        .get_user_division(&member_501_ctx, club_id, member_501_id)
        .await
        .expect("get division 501");
    assert_eq!(division_501, Some(2));
}

#[tokio::test]
async fn test_rebalance_divisions() {
    let (svc, _repo, db) = setup_db().await;
    let ctx = test_ctx();
    let owner_id = ctx.user_id.unwrap();
    ensure_user(&db, owner_id).await;
    let club_id = svc
        .create_club(&ctx, "Rebalance Club", None, owner_id)
        .await
        .expect("create");

    svc.join_club(&ctx, club_id, owner_id)
        .await
        .expect("owner join");

    // Add 999 more members (total 1000)
    for _i in 0..999 {
        let member_ctx = RequestContext {
            request_id: Uuid::new_v4(),
            user_id: Some(UserId(Uuid::new_v4())),
            ip: "127.0.0.1".to_string(),
        };
        let member_id = member_ctx.user_id.unwrap();
        ensure_user(&db, member_id).await;
        svc.join_club(&member_ctx, club_id, member_id)
            .await
            .expect("join");
    }

    // Verify we have 2 divisions
    let page = svc
        .get_leaderboard(&ctx, club_id, 1)
        .await
        .expect("get leaderboard");
    assert_eq!(page.total_divisions, 2);

    // Rebalance
    svc.rebalance_divisions(&ctx, club_id)
        .await
        .expect("rebalance");

    // After rebalance, both divisions should have 500 members
    let div1 = svc
        .get_leaderboard(&ctx, club_id, 1)
        .await
        .expect("get div1");
    let div2 = svc
        .get_leaderboard(&ctx, club_id, 2)
        .await
        .expect("get div2");

    assert_eq!(div1.entries.len(), 500);
    assert_eq!(div2.entries.len(), 500);
}

#[tokio::test]
async fn test_division_assignment_edge_cases() {
    let (svc, _repo, db) = setup_db().await;
    let ctx = test_ctx();
    let owner_id = ctx.user_id.unwrap();
    ensure_user(&db, owner_id).await;
    let club_id = svc
        .create_club(&ctx, "Edge Case Club", None, owner_id)
        .await
        .expect("create");

    // Test exactly 500 members (all in division 1)
    svc.join_club(&ctx, club_id, owner_id)
        .await
        .expect("owner join");

    for _i in 0..499 {
        let member_ctx = RequestContext {
            request_id: Uuid::new_v4(),
            user_id: Some(UserId(Uuid::new_v4())),
            ip: "127.0.0.1".to_string(),
        };
        let member_id = member_ctx.user_id.unwrap();
        ensure_user(&db, member_id).await;
        svc.join_club(&member_ctx, club_id, member_id)
            .await
            .expect("join");
    }

    let page = svc
        .get_leaderboard(&ctx, club_id, 1)
        .await
        .expect("get leaderboard");
    assert_eq!(page.total_members, 500);
    assert_eq!(page.total_divisions, 1);

    // Add one more (501st) - should create division 2
    let member_501_ctx = RequestContext {
        request_id: Uuid::new_v4(),
        user_id: Some(UserId(Uuid::new_v4())),
        ip: "127.0.0.1".to_string(),
    };
    let member_501_id = member_501_ctx.user_id.unwrap();
    ensure_user(&db, member_501_id).await;
    svc.join_club(&member_501_ctx, club_id, member_501_id)
        .await
        .expect("join 501st");

    let page = svc
        .get_leaderboard(&ctx, club_id, 1)
        .await
        .expect("get leaderboard after 501");
    assert_eq!(page.total_members, 501);
    assert_eq!(page.total_divisions, 2);
}

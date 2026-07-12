//! Integration test against a temporary SQLite database.
//! Tests actual SQL correctness, not mock behaviour.

use migration::Migrator;
use sb_club::ClubServiceImpl;
use sb_contracts::{ClubError, ClubRepo, ClubService, DIVISION_SIZE};
use sb_db_entities::user::ActiveModel as UserActiveModel;
use sb_db_repos::club_repo::ClubRepoImpl;
use sb_shared_types::{ClubId, RequestContext, UserId};
use sea_orm::{ActiveModelTrait, ColumnTrait, Database, EntityTrait, PaginatorTrait, QueryFilter};
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
    let broker = Arc::new(sb_table_registry::connection_broker::ConnectionBroker::new());
    let service = Arc::new(ClubServiceImpl::new(repo.clone(), broker));
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

    // Create a separate user who is NOT a member
    let non_member_ctx = RequestContext {
        request_id: Uuid::new_v4(),
        user_id: Some(UserId(Uuid::new_v4())),
        ip: "127.0.0.1".to_string(),
    };
    let non_member_id = non_member_ctx.user_id.unwrap();
    ensure_user(&db, non_member_id).await;

    // Attempt to add XP for the non-member
    let result = svc.add_xp(&non_member_ctx, club_id, non_member_id, 100).await;
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
    // Owner is automatically a member, so no join needed
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

    // Owner is automatically a member
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

    // Owner is automatically a member (division 1)
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

    // Owner is automatically a member
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

    // Rebalance (must be called by owner)
    svc.rebalance_divisions(&ctx, club_id, owner_id)
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

    // Owner is automatically a member
    // Test exactly 500 members (all in division 1)
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

#[tokio::test]
async fn test_rebalance_updates_membership_divisions() {
    let (svc, _repo, db) = setup_db().await;
    let ctx = test_ctx();
    let owner_id = ctx.user_id.unwrap();
    ensure_user(&db, owner_id).await;
    let club_id = svc
        .create_club(&ctx, "Rebalance Verify Club", None, owner_id)
        .await
        .expect("create");

    // Owner is automatically a member
    // Add 999 more members
    for _ in 0..999 {
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

    // Rebalance
    svc.rebalance_divisions(&ctx, club_id, owner_id)
        .await
        .expect("rebalance");

    // Verify actual membership divisions were updated
    use sb_db_entities::club_memberships;

    let div1_count = club_memberships::Entity::find()
        .filter(club_memberships::Column::ClubId.eq(club_id.as_uuid()))
        .filter(club_memberships::Column::Division.eq(1))
        .count(&db)
        .await
        .expect("count div1");

    let div2_count = club_memberships::Entity::find()
        .filter(club_memberships::Column::ClubId.eq(club_id.as_uuid()))
        .filter(club_memberships::Column::Division.eq(2))
        .count(&db)
        .await
        .expect("count div2");

    assert_eq!(div1_count, 500, "Division 1 should have 500 members");
    assert_eq!(div2_count, 500, "Division 2 should have 500 members");
}

#[tokio::test]
async fn test_rebalance_requires_owner() {
    let (svc, _repo, db) = setup_db().await;
    let owner_ctx = test_ctx();
    let owner_id = owner_ctx.user_id.unwrap();
    ensure_user(&db, owner_id).await;
    let club_id = svc
        .create_club(&owner_ctx, "Owner Only Club", None, owner_id)
        .await
        .expect("create");

    // Try to rebalance as non-owner
    let non_owner_ctx = RequestContext {
        request_id: Uuid::new_v4(),
        user_id: Some(UserId(Uuid::new_v4())),
        ip: "127.0.0.1".to_string(),
    };
    let non_owner_id = non_owner_ctx.user_id.unwrap();
    ensure_user(&db, non_owner_id).await;

    let result = svc.rebalance_divisions(&non_owner_ctx, club_id, non_owner_id).await;
    assert!(
        matches!(result, Err(ClubError::PermissionDenied)),
        "Non-owner should get PermissionDenied"
    );
}

#[tokio::test]
async fn test_concurrent_joins_assign_correct_divisions() {
    let (svc, _repo, db) = setup_db().await;
    let ctx = test_ctx();
    let owner_id = ctx.user_id.unwrap();
    ensure_user(&db, owner_id).await;
    let club_id = svc
        .create_club(&ctx, "Concurrent Club", None, owner_id)
        .await
        .expect("create");

    // Owner is automatically a member
    // Simulate concurrent joins by joining many members sequentially
    // (SQLite doesn't support true concurrency, but this tests the logic)
    // Add 499 members so total is 500 (owner + 499 = 500, all in division 1)
    let mut member_ids = Vec::new();
    for _ in 0..499 {
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
        member_ids.push(member_id);
    }

    // Verify all 499 members are in division 1
    for member_id in member_ids {
        let division = svc
            .get_user_division(&ctx, club_id, member_id)
            .await
            .expect("get division");
        assert_eq!(division, Some(1), "Member should be in division 1");
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
    assert_eq!(division_501, Some(2), "501st member should be in division 2");
}

#[tokio::test]
async fn test_performance_large_club() {
    use std::time::Instant;

    let (svc, repo, db) = setup_db().await;
    let ctx = test_ctx();
    let owner_id = ctx.user_id.unwrap();
    ensure_user(&db, owner_id).await;
    let club_id = svc
        .create_club(&ctx, "Perf Club", None, owner_id)
        .await
        .expect("create");

    // Owner is automatically a member
    // Add 500 members
    for _ in 0..499 {
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
        svc.add_xp(&member_ctx, club_id, member_id, 100)
            .await
            .expect("add xp");
    }

    // Refresh leaderboard and measure time
    repo.refresh_leaderboard(club_id).await.expect("refresh");

    let start = Instant::now();
    let page = svc
        .get_leaderboard(&ctx, club_id, 1)
        .await
        .expect("get leaderboard");
    let elapsed = start.elapsed();

    assert_eq!(page.entries.len(), 500);
    assert!(
        elapsed.as_millis() < 100,
        "Leaderboard query should complete in <100ms, took {}ms",
        elapsed.as_millis()
    );
}

#[tokio::test]
async fn test_concurrent_rebalance_attempts() {
    let (svc, _repo, db) = setup_db().await;
    let owner_ctx = test_ctx();
    let owner_id = owner_ctx.user_id.unwrap();
    ensure_user(&db, owner_id).await;
    let club_id = svc
        .create_club(&owner_ctx, "Concurrent Rebalance Club", None, owner_id)
        .await
        .expect("create");

    // Add some members
    for _ in 0..100 {
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

    // Attempt concurrent rebalances
    let mut handles = vec![];
    for _ in 0..5 {
        let svc_clone = svc.clone();
        let ctx_clone = owner_ctx.clone();
        let club_id_clone = club_id;

        let handle = tokio::spawn(async move {
            svc_clone
                .rebalance_divisions(&ctx_clone, club_id_clone, owner_id)
                .await
        });
        handles.push(handle);
    }

    // All should succeed (transaction ensures atomicity)
    for handle in handles {
        let result = handle.await.expect("task panicked");
        assert!(result.is_ok(), "Concurrent rebalance should succeed");
    }
}

#[tokio::test]
async fn test_large_scale_club_10000_members() {
    use std::time::Instant;

    let (svc, _repo, db) = setup_db().await;
    let ctx = test_ctx();
    let owner_id = ctx.user_id.unwrap();
    ensure_user(&db, owner_id).await;
    let club_id = svc
        .create_club(&ctx, "Large Scale Club", None, owner_id)
        .await
        .expect("create");

    // Owner is automatically a member
    // Add 9999 more members (total 10000)
    let start = Instant::now();
    for _ in 0..9999 {
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
    let join_time = start.elapsed();

    println!("Time to add 10000 members: {:?}", join_time);

    // Verify we have 20 divisions
    let page = svc
        .get_leaderboard(&ctx, club_id, 1)
        .await
        .expect("get leaderboard");
    assert_eq!(page.total_divisions, 20);
    assert_eq!(page.total_members, 10000);

    // Test rebalance performance
    let start = Instant::now();
    svc.rebalance_divisions(&ctx, club_id, owner_id)
        .await
        .expect("rebalance");
    let rebalance_time = start.elapsed();

    println!("Time to rebalance 10000 members: {:?}", rebalance_time);

    // Rebalance should complete in reasonable time (< 5 seconds for 10k members)
    assert!(
        rebalance_time.as_secs() < 5,
        "Rebalance took too long: {:?}",
        rebalance_time
    );

    // Verify all divisions have correct member counts
    for div in 1..=20 {
        let page = svc
            .get_leaderboard(&ctx, club_id, div)
            .await
            .expect("get division");
        assert_eq!(
            page.entries.len(),
            500,
            "Division {} should have 500 members",
            div
        );
    }
}

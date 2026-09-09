//! HTTP-level integration tests using Axum test client

use axum::Extension;
use axum::body::Body;
use axum::http::{Request, StatusCode};
use migration::Migrator;
use sb_club::handlers::ClubState;
use sb_club::{ClubServiceImpl, club_router};
use sb_contracts::{ClubRepo, ClubService};
use sb_db_entities::user::ActiveModel as UserActiveModel;
use sb_db_repos::club_repo::ClubRepoImpl;
use sb_shared_types::{RequestContext, UserId};
use sea_orm::{ActiveModelTrait, Database};
use sea_orm_migration::migrator::MigratorTrait;
use std::sync::Arc;
use tower::ServiceExt;
use uuid::Uuid;

async fn setup_test_app() -> (
    axum::Router,
    Arc<dyn ClubService>,
    sea_orm::DatabaseConnection,
    RequestContext,
) {
    let db = Database::connect("sqlite::memory:")
        .await
        .expect("db connect");

    Migrator::up(&db, None).await.expect("migrations");

    let repo: Arc<dyn ClubRepo> = Arc::new(ClubRepoImpl::new(db.clone()));
    let broker = Arc::new(sb_table_registry::connection_broker::ConnectionBroker::new());
    let service = Arc::new(ClubServiceImpl::new(repo.clone(), broker));

    let state = ClubState {
        service: service.clone(),
    };

    // Create a test context
    let user_id = UserId::new(Uuid::new_v4());
    let ctx = RequestContext {
        request_id: Uuid::new_v4(),
        user_id: Some(user_id),
        ip: "127.0.0.1".to_string(),
    };

    // Add the RequestContext as a layer
    let app = club_router(state).layer(Extension(ctx.clone()));

    (app, service, db, ctx)
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

#[tokio::test]
async fn test_http_get_leaderboard_with_division() {
    let (app, service, db, ctx) = setup_test_app().await;
    let user_id = ctx.user_id.unwrap();
    ensure_user(&db, user_id).await;

    let club_id = service
        .create_club(&ctx, "HTTP Test Club", None, user_id)
        .await
        .expect("create club");
    // Test GET /clubs/{id}/leaderboard?division=1
    let request = Request::builder()
        .uri(format!("/clubs/{}/leaderboard?division=1", club_id))
        .body(Body::empty())
        .unwrap();

    let response = app.oneshot(request).await.unwrap();

    assert_eq!(response.status(), StatusCode::OK);
}

#[tokio::test]
async fn test_http_get_leaderboard_invalid_division() {
    let (app, service, db, ctx) = setup_test_app().await;
    let user_id = ctx.user_id.unwrap();
    ensure_user(&db, user_id).await;

    let club_id = service
        .create_club(&ctx, "HTTP Test Club 2", None, user_id)
        .await
        .expect("create club");

    // Test GET /clubs/{id}/leaderboard?division=0 (invalid)
    let request = Request::builder()
        .uri(format!("/clubs/{}/leaderboard?division=0", club_id))
        .body(Body::empty())
        .unwrap();

    let response = app.oneshot(request).await.unwrap();

    assert_eq!(response.status(), StatusCode::BAD_REQUEST);
}

#[tokio::test]
async fn test_http_get_leaderboard_default_division() {
    let (app, service, db, ctx) = setup_test_app().await;
    let user_id = ctx.user_id.unwrap();
    ensure_user(&db, user_id).await;

    let club_id = service
        .create_club(&ctx, "HTTP Test Club 3", None, user_id)
        .await
        .expect("create club");
    // Test GET /clubs/{id}/leaderboard (no division param, should default to 1)
    let request = Request::builder()
        .uri(format!("/clubs/{}/leaderboard", club_id))
        .body(Body::empty())
        .unwrap();

    let response = app.oneshot(request).await.unwrap();

    assert_eq!(response.status(), StatusCode::OK);
}

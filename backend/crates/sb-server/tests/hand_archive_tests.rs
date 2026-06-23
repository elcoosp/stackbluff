use sea_orm::{ConnectionTrait, Database, DatabaseBackend, EntityTrait, Schema, Set};
use sb_db_entities::hand_history::{ActiveModel, Entity as HandHistory};
use sb_db_entities::hand_history_json::{HandPlayers, HandActions, HandResult};
use sb_server::hand_archive::{run_archival_with_r2, R2Storage};
use chrono::{DateTime, Duration, Utc};
use mockall::mock;
use uuid::Uuid;

mock! {
    pub R2Mock {}
    #[async_trait::async_trait]
    impl R2Storage for R2Mock {
        async fn put_object(&self, key: &str, data: Vec<u8>) -> Result<(), String>;
        async fn get_object(&self, key: &str) -> Result<Vec<u8>, String>;
    }
}

async fn setup_db() -> sea_orm::DatabaseConnection {
    let db = Database::connect("sqlite::memory:").await.unwrap();
    let schema = Schema::new(DatabaseBackend::Sqlite);
    let table_create = schema.create_table_from_entity(HandHistory);
    db.execute(&table_create).await.unwrap();
    db
}

#[tokio::test]
async fn upload_success_marks_archived() {
    let db = setup_db().await;
    let old_date: DateTime<Utc> = Utc::now() - Duration::days(40);
    let id = Uuid::new_v4();
    let table_id = Uuid::new_v4();
    let hand = ActiveModel {
        id: Set(id),
        table_id: Set(table_id),
        played_at: Set(old_date),
        participants: Set("[]".to_string()),
        players_json: Set(HandPlayers { seats: vec![] }),
        actions_json: Set(HandActions { actions: vec![] }),
        result_json: Set(HandResult {
            winners: vec![],
            pot_distribution: vec![],
            community_cards: vec![],
        }),
        is_archived: Set(false),
        ..Default::default()
    };
    HandHistory::insert(hand).exec(&db).await.unwrap();

    let mut r2 = MockR2Mock::new();
    r2.expect_put_object()
        .returning(|_, _| Ok(()));

    let cutoff = Utc::now() - Duration::days(30);
    run_archival_with_r2(&db, &r2, cutoff).await.unwrap();

    let hand = HandHistory::find_by_id(id).one(&db).await.unwrap().unwrap();
    assert!(hand.is_archived);
}

#[tokio::test]
async fn upload_failure_leaves_unarchived() {
    let db = setup_db().await;
    let old_date: DateTime<Utc> = Utc::now() - Duration::days(40);
    let id = Uuid::new_v4();
    let table_id = Uuid::new_v4();
    let hand = ActiveModel {
        id: Set(id),
        table_id: Set(table_id),
        played_at: Set(old_date),
        participants: Set("[]".to_string()),
        players_json: Set(HandPlayers { seats: vec![] }),
        actions_json: Set(HandActions { actions: vec![] }),
        result_json: Set(HandResult {
            winners: vec![],
            pot_distribution: vec![],
            community_cards: vec![],
        }),
        is_archived: Set(false),
        ..Default::default()
    };
    HandHistory::insert(hand).exec(&db).await.unwrap();

    let mut r2 = MockR2Mock::new();
    r2.expect_put_object()
        .returning(|_, _| Err("simulated failure".into()));

    let cutoff = Utc::now() - Duration::days(30);
    run_archival_with_r2(&db, &r2, cutoff).await.unwrap();

    let hand = HandHistory::find_by_id(id).one(&db).await.unwrap().unwrap();
    assert!(!hand.is_archived);
}

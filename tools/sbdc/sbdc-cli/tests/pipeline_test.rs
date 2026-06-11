use sbdc_entity::{character, clan, deck, deck_narrative_arc, generated_prompt};
use sbdc_migration::Migrator;
use sbdc_migration::MigratorTrait;
use sbdc_service::{build_prompts, clean, generate, ingest, init, scaffold};
use sea_orm::{
    ColumnTrait, ConnectionTrait, Database, DatabaseConnection, EntityTrait, QueryFilter,
};
use tempfile::tempdir;

async fn setup_test_db() -> DatabaseConnection {
    let db = Database::connect("sqlite::memory:").await.unwrap();
    db.execute_unprepared("PRAGMA foreign_keys = ON;")
        .await
        .unwrap();
    Migrator::up(&db, None).await.unwrap();
    db
}

#[tokio::test]
async fn full_pipeline_e2e() {
    let db = setup_test_db().await;
    let dir = tempdir().unwrap();

    // Init
    init::run_init(&db, dir.path()).await.unwrap();
    assert_eq!(clan::Entity::find().all(&db).await.unwrap().len(), 4);
    assert_eq!(character::Entity::find().all(&db).await.unwrap().len(), 4);

    // Scaffold
    scaffold::run_scaffold(&db, dir.path(), "e2e-deck", "default_season")
        .await
        .unwrap();
    let deck_model = deck::Entity::find()
        .filter(deck::Column::DeckId.eq("e2e-deck"))
        .one(&db)
        .await
        .unwrap()
        .unwrap();
    assert_eq!(deck_model.status, "pending");
    let arcs = deck_narrative_arc::Entity::find()
        .filter(deck_narrative_arc::Column::DeckId.eq("e2e-deck"))
        .all(&db)
        .await
        .unwrap();
    assert_eq!(arcs.len(), 52);

    // Ingest JSON
    let json_path = dir.path().join("ingest.json");
    let ingest_payload = serde_json::json!({
        "lore_entries": [{
            "parent_entity": "deck",
            "parent_id": "e2e-deck",
            "category": "history",
            "title": "War",
            "content": "The clans fought",
            "source": "ext",
            "status": "approved",
            "injectable": true,
            "injection_weight": 5
        }],
        "narrative_arcs": [
            {"rank": "2", "suit": "s", "description": "Breach the wall"}
        ]
    });
    tokio::fs::write(&json_path, serde_json::to_string(&ingest_payload).unwrap())
        .await
        .unwrap();
    ingest::run_ingest_json(&db, "e2e-deck", &json_path)
        .await
        .unwrap();

    // Build Prompts
    build_prompts::run_build_prompts(&db, "e2e-deck")
        .await
        .unwrap();
    let prompts = generated_prompt::Entity::find()
        .filter(generated_prompt::Column::DeckId.eq("e2e-deck"))
        .filter(generated_prompt::Column::Status.eq("ready_to_generate"))
        .all(&db)
        .await
        .unwrap();
    assert!(!prompts.is_empty());

    // Verify face card has character DNA
    let ks_full = prompts
        .iter()
        .find(|p| p.target_card == "Ks" && p.target_layer == "subject")
        .unwrap();
    assert!(
        ks_full.final_positive.contains("stern king"),
        "Missing character injection"
    );
    assert!(
        ks_full.final_positive.contains("pure white background"),
        "Missing background invariant"
    );

    // Verify number card has narrative arc
    let scene_2s = prompts
        .iter()
        .find(|p| p.target_card == "2s" && p.target_layer == "env")
        .unwrap();
    assert!(
        scene_2s.final_positive.contains("Breach the wall"),
        "Missing narrative arc injection"
    );

    // Generate (takes=0 to avoid Node call in test)
    generate::run_generate(&db, dir.path(), "e2e-deck", 0, "5-15")
        .await
        .unwrap();

    // Clean (no selected takes, but should run)
    clean::run_clean(&db, dir.path(), "e2e-deck").await.unwrap();
}

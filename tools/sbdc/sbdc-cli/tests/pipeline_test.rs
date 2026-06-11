use sbdc_entity::{character, clan, deck, deck_narrative_arc, generated_prompt, prompt_take};
use sbdc_migration::Migrator;
use sbdc_migration::MigratorTrait;
use sbdc_service::{build_prompts, clean, ingest, init, scaffold};
use sea_orm::{
    ActiveModelTrait, ColumnTrait, ConnectionTrait, Database, DatabaseConnection, EntityTrait,
    QueryFilter, Set,
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

    // Phase 1: Init
    init::run_init(&db, dir.path()).await.unwrap();
    assert_eq!(clan::Entity::find().all(&db).await.unwrap().len(), 4);
    assert_eq!(character::Entity::find().all(&db).await.unwrap().len(), 4);

    // Phase 1: Scaffold
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

    // Phase 1: Ingest JSON
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

    // Phase 1: Build Prompts
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

    // Phase 2 (simulated): Simulate extension driving generation via DB
    // The extension would call /api/decks/e2e-deck/prompts/next repeatedly,
    // generate images on perchance, then POST /api/decks/e2e-deck/prompts/{id}/takes
    // Here we simulate by directly updating the DB status and creating take records.

    let ready_prompts = generated_prompt::Entity::find()
        .filter(generated_prompt::Column::DeckId.eq("e2e-deck"))
        .filter(generated_prompt::Column::Status.eq("ready_to_generate"))
        .all(&db)
        .await
        .unwrap();

    let takes_dir = dir.path().join("decks").join("default_season").join("e2e-deck").join("0-takes");
    let clean_dir = dir.path().join("decks").join("default_season").join("e2e-deck").join("3-clean");

    for prompt in &ready_prompts {
        let card_dir = takes_dir.join(&prompt.target_card);
        tokio::fs::create_dir_all(&card_dir).await.unwrap();

        let fake_png = vec![0x89u8, 0x50, 0x4E, 0x47];
        let file_path = card_dir.join("take_1.png");
        tokio::fs::write(&file_path, &fake_png).await.unwrap();

        let take = prompt_take::ActiveModel {
            is_selected: Set(true),
            prompt_id: Set(prompt.prompt_id),
            file_path: Set(file_path.to_str().unwrap().to_string()),
            ..Default::default()
        };
        take.insert(&db).await.unwrap();

        let mut active: generated_prompt::ActiveModel = prompt.clone().into();
        active.status = Set("takes_ready".into());
        active.update(&db).await.unwrap();
    }

    // Phase 3: Clean
    tokio::fs::create_dir_all(&clean_dir).await.unwrap();
    clean::run_clean(&db, dir.path(), "e2e-deck").await.unwrap();

    let cleaned = generated_prompt::Entity::find()
        .filter(generated_prompt::Column::DeckId.eq("e2e-deck"))
        .filter(generated_prompt::Column::Status.eq("cleaned"))
        .all(&db)
        .await
        .unwrap();
    assert_eq!(cleaned.len(), ready_prompts.len(), "All prompts should be cleaned");
}

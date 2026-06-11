#[cfg(test)]
mod tests {
    use super::*;
    use sea_orm::{Database, DatabaseConnection};
    use tempfile::tempdir;
    use sbdc_dto::ingest::ArcPayload;

    async fn setup_test_db() -> DatabaseConnection {
        let db = Database::connect("sqlite::memory:").await.unwrap();
        db.get_schema_registry("sbdc_entity::*").sync(&db).await.unwrap();
        db
    }

    async fn create_test_deck(db: &DatabaseConnection, deck_id: &str) {
        use sbdc_entity::deck;
        let deck = deck::ActiveModel {
            deck_id: Set(deck_id.to_string()),
            season_id: Set("test_season".to_string()),
            status: Set("pending".to_string()),
            art_style: Set("test".to_string()),
            theme: Set("test".to_string()),
            junction_type: Set("junction-battle".to_string()),
        };
        deck.insert(db).await.unwrap();
    }

    #[tokio::test]
    async fn ingest_valid_payload_updates_arcs() {
        let db = setup_test_db().await;
        let deck_id = "ingest-test";
        create_test_deck(&db, deck_id).await;

        // First scaffold to have initial arcs
        use crate::scaffold::run_scaffold;
        let dir = tempdir().unwrap();
        run_scaffold(&db, dir.path(), deck_id, "test_season").await.unwrap();

        let json_path = dir.path().join("ingest.json");
        let payload = serde_json::json!({
            "narrative_arcs": [
                {"rank": "2", "suit": "s", "description": "Updated breach description"},
                {"rank": "3", "suit": "h", "description": "New heart arc"}
            ]
        });
        let json_string = serde_json::to_string(&payload).unwrap();
        tokio::fs::write(&json_path, json_string).await.unwrap();

        run_ingest_json(&db, deck_id, &json_path).await.unwrap();

        let updated_arc = deck_narrative_arc::Entity::find()
            .filter(deck_narrative_arc::COLUMN.deck_id.eq(deck_id))
            .filter(deck_narrative_arc::COLUMN.rank.eq("2"))
            .filter(deck_narrative_arc::COLUMN.suit.eq("s"))
            .one(&db).await.unwrap()
            .unwrap();
        assert_eq!(updated_arc.description, "Updated breach description");
    }
}

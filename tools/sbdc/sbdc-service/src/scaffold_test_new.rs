#[cfg(test)]
mod tests {
    use super::*;
    use sea_orm::{Database, DatabaseConnection};
    use tempfile::tempdir;

    async fn setup_test_db() -> DatabaseConnection {
        let db = Database::connect("sqlite::memory:").await.unwrap();
        db.get_schema_registry("sbdc_entity::*").sync(&db).await.unwrap();
        db
    }

    #[tokio::test]
    async fn scaffold_creates_deck_and_arcs() {
        let db = setup_test_db().await;
        let dir = tempdir().unwrap();
        run_scaffold(&db, dir.path(), "test-deck", "test-season").await.unwrap();

        let deck = deck::Entity::find().filter(deck::COLUMN.deck_id.eq("test-deck")).one(&db).await.unwrap();
        assert!(deck.is_some());
        let arcs = deck_narrative_arc::Entity::find().filter(deck_narrative_arc::COLUMN.deck_id.eq("test-deck")).all(&db).await.unwrap();
        assert_eq!(arcs.len(), 52);
        let prompts = generated_prompt::Entity::find().filter(generated_prompt::COLUMN.deck_id.eq("test-deck")).all(&db).await.unwrap();
        assert_eq!(prompts.len(), 52);
    }

    #[tokio::test]
    async fn scaffold_fails_on_duplicate() {
        let db = setup_test_db().await;
        let dir = tempdir().unwrap();
        run_scaffold(&db, dir.path(), "dup-deck", "season").await.unwrap();
        let result = run_scaffold(&db, dir.path(), "dup-deck", "season").await;
        assert!(matches!(result, Err(SbdcError::DeckAlreadyExists(_))));
    }
}

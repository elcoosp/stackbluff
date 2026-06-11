#[cfg(test)]
mod tests {
    use super::*;
    use sea_orm::{Database, DatabaseConnection, ConnectionTrait};
    use crate::init::run_init;
    use crate::scaffold::run_scaffold;
    use sbdc_migration::Migrator;
    use sbdc_migration::MigratorTrait;
    use tempfile::tempdir;

    async fn setup_test_db() -> DatabaseConnection {
        let db = Database::connect("sqlite::memory:").await.unwrap();
        db.execute_unprepared("PRAGMA foreign_keys = ON;").await.unwrap();
        Migrator::up(&db, None).await.unwrap();
        db
    }

    #[tokio::test]
    async fn build_prompts_generates_ready_prompts() {
        let db = setup_test_db().await;
        let dir = tempdir().unwrap();
        run_init(&db, dir.path()).await.unwrap();
        run_scaffold(&db, dir.path(), "build-test", "default_season").await.unwrap();

        run_build_prompts(&db, "build-test").await.unwrap();

        let prompts = generated_prompt::Entity::find()
            .filter(generated_prompt::Column::DeckId.eq("build-test"))
            .filter(generated_prompt::Column::Status.eq("ready_to_generate"))
            .all(&db).await.unwrap();
        assert!(!prompts.is_empty(), "Should have generated prompts");
        let face_prompt = prompts.iter().find(|p| p.target_card == "Ks").unwrap();
        assert!(face_prompt.final_positive.contains("stern king"), "Face card missing character injection");
    }
}

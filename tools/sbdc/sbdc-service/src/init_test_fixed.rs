#[cfg(test)]
mod tests {
    use super::*;
    use sea_orm::{Database, DatabaseConnection, ConnectionTrait};
    use sbdc_migration::Migrator;
    use sbdc_migration::MigratorTrait;
    use tempfile::tempdir;

    async fn setup_test_db() -> DatabaseConnection {
        let db = Database::connect("sqlite::memory:").await.unwrap();
        // Enable foreign keys for SQLite using execute_raw
        db.execute_raw("PRAGMA foreign_keys = ON;").await.unwrap();
        Migrator::up(&db, None).await.unwrap();
        db
    }

    #[tokio::test]
    async fn init_seeds_universe_and_clans() {
        let db = setup_test_db().await;
        let dir = tempdir().unwrap();
        run_init(&db, dir.path()).await.unwrap();

        let clans = clan::Entity::find().all(&db).await.unwrap();
        assert_eq!(clans.len(), 4);
        let chars = character::Entity::find().all(&db).await.unwrap();
        assert_eq!(chars.len(), 4);
        let uni = universe::Entity::find().one(&db).await.unwrap();
        assert!(uni.is_some());
    }
}

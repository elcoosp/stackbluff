use sea_orm_migration::prelude::*;

#[derive(DeriveMigrationName)]
pub struct Migration;

#[async_trait::async_trait]
impl MigrationTrait for Migration {
    async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        let sql = r#"
            CREATE TABLE device_fingerprints (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                fingerprint_hash TEXT NOT NULL,
                ip TEXT NOT NULL,
                created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(user_id, fingerprint_hash)
            );
            CREATE INDEX idx_device_fingerprints_hash_ip ON device_fingerprints (fingerprint_hash, ip);
        "#;
        manager.get_connection().execute_unprepared(sql).await?;
        Ok(())
    }

    async fn down(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        let sql = r#"
            DROP INDEX idx_device_fingerprints_hash_ip;
            DROP TABLE device_fingerprints;
        "#;
        manager.get_connection().execute_unprepared(sql).await?;
        Ok(())
    }
}

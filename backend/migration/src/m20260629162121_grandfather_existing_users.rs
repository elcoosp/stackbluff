use sea_orm_migration::prelude::*;

#[derive(DeriveMigrationName)]
#[allow(dead_code)]
pub struct Migration;

#[async_trait::async_trait]
impl MigrationTrait for Migration {
    async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        // Grandfather in existing PWA users who registered before email verification was added
        // Set their email_verified_at to their created_at timestamp
        // This assumes they verified their email during registration (which was the old flow)

        let db = manager.get_connection();

        // For PWA users created before this migration, set email_verified_at = created_at
        db.execute_unprepared(
            "UPDATE users
             SET email_verified_at = created_at
             WHERE platform = 'pwa'
             AND email_verified_at IS NULL
             AND created_at < datetime('now', '-1 day')"
        ).await?;

        // For Telegram users, they don't need email verification
        // (handled by platform check in payment service)

        Ok(())
    }

    async fn down(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        // Revert: set email_verified_at back to NULL for migrated users
        let db = manager.get_connection();

        db.execute_unprepared(
            "UPDATE users
             SET email_verified_at = NULL
             WHERE platform = 'pwa'
             AND email_verified_at = created_at"
        ).await?;

        Ok(())
    }
}

use sea_orm_migration::prelude::*;

#[derive(DeriveMigrationName)]
pub struct Migration;

#[async_trait::async_trait]
impl MigrationTrait for Migration {
    async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        // ── clubs ─────────────────────────────────────────────
        // Migration 1 already created the `clubs` table (via club::Entity)
        // but without logo_url, created_by, and updated_at columns.
        // SQLite only allows one ADD COLUMN per ALTER TABLE, so issue three.
        manager
            .alter_table(
                Table::alter()
                    .table(Alias::new("clubs"))
                    .add_column(ColumnDef::new(Alias::new("logo_url")).text())
                    .to_owned(),
            )
            .await?;

        manager
            .alter_table(
                Table::alter()
                    .table(Alias::new("clubs"))
                    .add_column(ColumnDef::new(Alias::new("created_by")).uuid())
                    .to_owned(),
            )
            .await?;

        manager
            .alter_table(
                Table::alter()
                    .table(Alias::new("clubs"))
                    .add_column(ColumnDef::new(Alias::new("updated_at")).timestamp_with_time_zone())
                    .to_owned(),
            )
            .await?;

        // ── club_memberships ──────────────────────────────────
        manager
            .create_table(
                Table::create()
                    .table(Alias::new("club_memberships"))
                    .if_not_exists()
                    .col(
                        ColumnDef::new(Alias::new("id"))
                            .uuid()
                            .not_null()
                            .primary_key(),
                    )
                    .col(ColumnDef::new(Alias::new("club_id")).uuid().not_null())
                    .col(ColumnDef::new(Alias::new("user_id")).uuid().not_null())
                    .col(
                        ColumnDef::new(Alias::new("weekly_xp"))
                            .big_integer()
                            .not_null()
                            .default(0),
                    )
                    .col(
                        ColumnDef::new(Alias::new("joined_at"))
                            .timestamp_with_time_zone()
                            .not_null(),
                    )
                    .col(
                        ColumnDef::new(Alias::new("updated_at"))
                            .timestamp_with_time_zone()
                            .not_null(),
                    )
                    .to_owned(),
            )
            .await?;

        // Unique constraint: one membership per user per club
        manager
            .create_index(
                Index::create()
                    .if_not_exists()
                    .name("idx_club_memberships_club_user")
                    .table(Alias::new("club_memberships"))
                    .col(Alias::new("club_id"))
                    .col(Alias::new("user_id"))
                    .unique()
                    .to_owned(),
            )
            .await?;

        // ── club_leaderboard (materialised snapshot) ──────────
        manager
            .create_table(
                Table::create()
                    .table(Alias::new("club_leaderboard"))
                    .if_not_exists()
                    .col(ColumnDef::new(Alias::new("club_id")).uuid().not_null())
                    .col(ColumnDef::new(Alias::new("user_id")).uuid().not_null())
                    .col(ColumnDef::new(Alias::new("rank")).integer().not_null())
                    .col(
                        ColumnDef::new(Alias::new("weekly_xp"))
                            .big_integer()
                            .not_null(),
                    )
                    .col(ColumnDef::new(Alias::new("division")).integer().not_null())
                    .col(
                        ColumnDef::new(Alias::new("refreshed_at"))
                            .timestamp_with_time_zone()
                            .not_null(),
                    )
                    .primary_key(
                        Index::create()
                            .col(Alias::new("club_id"))
                            .col(Alias::new("user_id")),
                    )
                    .to_owned(),
            )
            .await?;

        // Index for leaderboard lookups by club + division
        manager
            .create_index(
                Index::create()
                    .if_not_exists()
                    .name("idx_club_leaderboard_club_div")
                    .table(Alias::new("club_leaderboard"))
                    .col(Alias::new("club_id"))
                    .col(Alias::new("division"))
                    .col(Alias::new("rank"))
                    .to_owned(),
            )
            .await?;

        Ok(())
    }

    async fn down(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .drop_table(
                Table::drop()
                    .table(Alias::new("club_leaderboard"))
                    .to_owned(),
            )
            .await?;
        manager
            .drop_table(
                Table::drop()
                    .table(Alias::new("club_memberships"))
                    .to_owned(),
            )
            .await?;
        // Note: added columns on `clubs` are not dropped here because
        // SQLite lacks ALTER TABLE DROP COLUMN support. The table is
        // owned by migration 1; a full rollback requires dropping it.
        Ok(())
    }
}

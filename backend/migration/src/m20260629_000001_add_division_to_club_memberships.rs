use sea_orm_migration::prelude::*;

#[derive(DeriveMigrationName)]
pub struct Migration;

#[async_trait::async_trait]
impl MigrationTrait for Migration {
    async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        // Add division column with default 1
        manager
            .alter_table(
                Table::alter()
                    .table(ClubMemberships::Table)
                    .add_column_if_not_exists(
                        ColumnDef::new(ClubMemberships::Division)
                            .integer()
                            .not_null()
                            .default(1),
                    )
                    .to_owned(),
            )
            .await?;

        // Add index on (club_id, division) for faster leaderboard queries
        manager
            .create_index(
                Index::create()
                    .if_not_exists()
                    .name("idx_club_memberships_club_division")
                    .table(ClubMemberships::Table)
                    .col(ClubMemberships::ClubId)
                    .col(ClubMemberships::Division)
                    .to_owned(),
            )
            .await?;

        Ok(())
    }

    async fn down(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .drop_index(
                Index::drop()
                    .name("idx_club_memberships_club_division")
                    .table(ClubMemberships::Table)
                    .to_owned(),
            )
            .await?;

        manager
            .alter_table(
                Table::alter()
                    .table(ClubMemberships::Table)
                    .drop_column(ClubMemberships::Division)
                    .to_owned(),
            )
            .await
    }
}

/// Reference to the club_memberships table for this migration
#[derive(Iden)]
enum ClubMemberships {
    Table,
    ClubId,
    Division,
}

use sea_orm_migration::prelude::*;

/// Migration to add division sharding for club leaderboards.
///
/// # Division Assignment Strategy
/// Members are assigned to divisions based on their join order:
/// - First 500 members: Division 1
/// - Next 500 members: Division 2
/// - And so on...
///
/// # Backfill Strategy
/// For existing clubs with >500 members, we use a temporary table approach
/// that works with all SQLite versions (no window functions required).
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

        // Backfill: Rebalance existing members into proper divisions
        // Uses a temporary table approach compatible with all SQLite versions
        let db = manager.get_connection();

        // Create temporary table with row numbers
        db.execute_unprepared(
            r#"
            CREATE TEMPORARY TABLE IF NOT EXISTS temp_member_ordering AS
            SELECT
                id,
                club_id,
                (SELECT COUNT(*) FROM club_memberships cm2
                 WHERE cm2.club_id = cm1.club_id
                 AND (cm2.joined_at < cm1.joined_at OR (cm2.joined_at = cm1.joined_at AND cm2.id < cm1.id))
                ) AS rn
            FROM club_memberships cm1
            "#,
        )
        .await?;

        // Update divisions based on row numbers
        db.execute_unprepared(
            r#"
            UPDATE club_memberships
            SET division = (
                SELECT (rn / 500) + 1
                FROM temp_member_ordering
                WHERE temp_member_ordering.id = club_memberships.id
            )
            WHERE EXISTS (
                SELECT 1 FROM temp_member_ordering
                WHERE temp_member_ordering.id = club_memberships.id
                AND (rn / 500) + 1 != club_memberships.division
            )
            "#,
        )
        .await?;

        // Clean up temporary table
        db.execute_unprepared("DROP TABLE IF EXISTS temp_member_ordering")
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

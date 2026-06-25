use sea_orm_migration::prelude::*;

#[derive(DeriveMigrationName)]
pub struct Migration;

#[async_trait::async_trait]
impl MigrationTrait for Migration {
    async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        // Create tables (idempotent with IF NOT EXISTS)
        manager
            .create_table(
                Table::create()
                    .table(DailyMission::Table)
                    .if_not_exists()
                    .col(
                        ColumnDef::new(DailyMission::Id)
                            .integer()
                            .not_null()
                            .auto_increment()
                            .primary_key(),
                    )
                    .col(ColumnDef::new(DailyMission::UserId).uuid().not_null())
                    .col(ColumnDef::new(DailyMission::AssignedDate).date().not_null())
                    .col(
                        ColumnDef::new(DailyMission::MissionType)
                            .string()
                            .not_null(),
                    )
                    .col(ColumnDef::new(DailyMission::Progress).integer().default(0))
                    .col(
                        ColumnDef::new(DailyMission::Completed)
                            .boolean()
                            .default(false),
                    )
                    .col(
                        ColumnDef::new(DailyMission::Rerolled)
                            .boolean()
                            .default(false),
                    )
                    .col(
                        ColumnDef::new(DailyMission::RewardClaimed)
                            .boolean()
                            .default(false),
                    )
                    .to_owned(),
            )
            .await?;

        // Index with IF NOT EXISTS – prevents “index already exists” errors
        manager
            .create_index(
                Index::create()
                    .name("idx-daily_mission-unique")
                    .table(DailyMission::Table)
                    .col(DailyMission::UserId)
                    .col(DailyMission::AssignedDate)
                    .col(DailyMission::MissionType)
                    .unique()
                    .if_not_exists()
                    .to_owned(),
            )
            .await?;

        manager
            .create_table(
                Table::create()
                    .table(MissionDefinition::Table)
                    .if_not_exists()
                    .col(
                        ColumnDef::new(MissionDefinition::MissionType)
                            .string()
                            .not_null()
                            .primary_key(),
                    )
                    .col(ColumnDef::new(MissionDefinition::Name).string().not_null())
                    .col(
                        ColumnDef::new(MissionDefinition::Description)
                            .string()
                            .not_null(),
                    )
                    .col(
                        ColumnDef::new(MissionDefinition::TargetValue)
                            .integer()
                            .not_null(),
                    )
                    .col(
                        ColumnDef::new(MissionDefinition::RewardChips)
                            .big_integer()
                            .not_null(),
                    )
                    .col(
                        ColumnDef::new(MissionDefinition::Category)
                            .string()
                            .not_null(),
                    )
                    .col(
                        ColumnDef::new(MissionDefinition::IsViral)
                            .boolean()
                            .default(false),
                    )
                    .to_owned(),
            )
            .await?;

        manager
            .create_table(
                Table::create()
                    .table(Streak::Table)
                    .if_not_exists()
                    .col(
                        ColumnDef::new(Streak::UserId)
                            .uuid()
                            .not_null()
                            .primary_key(),
                    )
                    .col(ColumnDef::new(Streak::CurrentStreak).integer().default(0))
                    .col(ColumnDef::new(Streak::LongestStreak).integer().default(0))
                    .col(ColumnDef::new(Streak::LastCompletionDate).date())
                    .col(ColumnDef::new(Streak::ShieldAvailable).integer().default(0))
                    .col(
                        ColumnDef::new(Streak::BonusAwardedStreak)
                            .integer()
                            .default(0),
                    )
                    .to_owned(),
            )
            .await?;

        // Helper to add a column and ignore “duplicate column” errors
        async fn add_column(
            manager: &SchemaManager<'_>,
            table: Alias,
            col_def: &mut ColumnDef,
        ) -> Result<(), DbErr> {
            let stmt = Table::alter()
                .table(table)
                .add_column(col_def.to_owned())
                .to_owned();
            if let Err(e) = manager.alter_table(stmt).await {
                let msg = e.to_string();
                if msg.contains("duplicate column name") {
                    Ok(())
                } else {
                    Err(e)
                }
            } else {
                Ok(())
            }
        }

        // Add columns one by one (SQLite limitation) – pass mutable references
        add_column(
            manager,
            Alias::new("users"),
            ColumnDef::new(Alias::new("streak_count"))
                .integer()
                .default(0),
        )
        .await?;

        add_column(
            manager,
            Alias::new("users"),
            ColumnDef::new(Alias::new("last_streak_date")).date(),
        )
        .await?;

        add_column(
            manager,
            Alias::new("users"),
            ColumnDef::new(Alias::new("weekly_bonus_awarded_streak"))
                .integer()
                .default(0),
        )
        .await?;

        Ok(())
    }

    async fn down(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        // Helper to drop a column and ignore “no such column” errors
        async fn drop_column(
            manager: &SchemaManager<'_>,
            table: Alias,
            column: &str,
        ) -> Result<(), DbErr> {
            let stmt = Table::alter()
                .table(table)
                .drop_column(Alias::new(column))
                .to_owned();
            if let Err(e) = manager.alter_table(stmt).await {
                let msg = e.to_string();
                if msg.contains("no such column") {
                    Ok(())
                } else {
                    Err(e)
                }
            } else {
                Ok(())
            }
        }

        drop_column(manager, Alias::new("users"), "streak_count").await?;
        drop_column(manager, Alias::new("users"), "last_streak_date").await?;
        drop_column(manager, Alias::new("users"), "weekly_bonus_awarded_streak").await?;

        // Drop tables
        manager
            .drop_table(Table::drop().table(DailyMission::Table).to_owned())
            .await?;
        manager
            .drop_table(Table::drop().table(MissionDefinition::Table).to_owned())
            .await?;
        manager
            .drop_table(Table::drop().table(Streak::Table).to_owned())
            .await?;

        Ok(())
    }
}

#[derive(DeriveIden)]
enum DailyMission {
    Table,
    Id,
    UserId,
    AssignedDate,
    MissionType,
    Progress,
    Completed,
    Rerolled,
    RewardClaimed,
}

#[derive(DeriveIden)]
enum MissionDefinition {
    Table,
    MissionType,
    Name,
    Description,
    TargetValue,
    RewardChips,
    Category,
    IsViral,
}

#[derive(DeriveIden)]
enum Streak {
    Table,
    UserId,
    CurrentStreak,
    LongestStreak,
    LastCompletionDate,
    ShieldAvailable,
    BonusAwardedStreak,
}

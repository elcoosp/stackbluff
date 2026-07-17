use sea_orm_migration::prelude::*;

#[derive(DeriveMigrationName)]
pub struct Migration;

#[async_trait::async_trait]
impl MigrationTrait for Migration {
    async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .alter_table(
                Table::alter()
                    .table(Alias::new("users"))
                    .add_column(
                        ColumnDef::new(Alias::new("is_bot"))
                            .boolean()
                            .not_null()
                            .default(false),
                    )
                    .to_owned(),
            )
            .await?;

        manager
            .alter_table(
                Table::alter()
                    .table(Alias::new("users"))
                    .add_column(
                        ColumnDef::new(Alias::new("bot_profile"))
                            .text()
                            .null(),
                    )
                    .to_owned(),
            )
            .await?;

        manager
            .alter_table(
                Table::alter()
                    .table(Alias::new("users"))
                    .add_column(
                        ColumnDef::new(Alias::new("bot_bankroll"))
                            .big_integer()
                            .default(0),
                    )
                    .to_owned(),
            )
            .await?;

        let _ = manager.get_connection().execute_unprepared(
            "CREATE INDEX IF NOT EXISTS idx_users_is_bot ON users(is_bot) WHERE is_bot = TRUE;"
        ).await;

        manager
            .create_table(
                Table::create()
                    .table(BotLedger::Table)
                    .if_not_exists()
                    .col(
                        ColumnDef::new(BotLedger::Id)
                            .big_integer()
                            .not_null()
                            .auto_increment()
                            .primary_key(),
                    )
                    .col(ColumnDef::new(BotLedger::BotUserId).uuid().not_null())
                    .col(ColumnDef::new(BotLedger::TableId).uuid().not_null())
                    .col(ColumnDef::new(BotLedger::Delta).big_integer().not_null())
                    .col(ColumnDef::new(BotLedger::Reason).text().not_null())
                    .col(
                        ColumnDef::new(BotLedger::CreatedAt)
                            .timestamp_with_time_zone()
                            .not_null()
                            .default(Expr::current_timestamp()),
                    )
                    .foreign_key(
                        ForeignKey::create()
                            .name("fk_bot_ledger_user")
                            .from(BotLedger::Table, BotLedger::BotUserId)
                            .to(Alias::new("users"), Alias::new("id"))
                            .on_delete(ForeignKeyAction::Cascade),
                    )
                    .to_owned(),
            )
            .await?;

        manager
            .create_index(
                Index::create()
                    .name("idx_bot_ledger_bot_user_id")
                    .table(BotLedger::Table)
                    .col(BotLedger::BotUserId)
                    .to_owned(),
            )
            .await?;

        Ok(())
    }

    async fn down(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .drop_table(Table::drop().table(BotLedger::Table).to_owned())
            .await?;

        let _ = manager.get_connection().execute_unprepared(
            "DROP INDEX IF EXISTS idx_users_is_bot;"
        ).await;

        manager
            .alter_table(
                Table::alter()
                    .table(Alias::new("users"))
                    .drop_column(Alias::new("bot_bankroll"))
                    .to_owned(),
            )
            .await?;

        manager
            .alter_table(
                Table::alter()
                    .table(Alias::new("users"))
                    .drop_column(Alias::new("bot_profile"))
                    .to_owned(),
            )
            .await?;

        manager
            .alter_table(
                Table::alter()
                    .table(Alias::new("users"))
                    .drop_column(Alias::new("is_bot"))
                    .to_owned(),
            )
            .await?;

        Ok(())
    }
}

#[derive(DeriveIden)]
enum BotLedger {
    Table,
    Id,
    BotUserId,
    TableId,
    Delta,
    Reason,
    CreatedAt,
}

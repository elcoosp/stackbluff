use sea_orm_migration::prelude::*;

#[derive(DeriveMigrationName)]
pub struct Migration;

#[async_trait::async_trait]
impl MigrationTrait for Migration {
    async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .alter_table(
                Table::alter()
                    .table(Tournament::Table)
                    .add_column_if_not_exists(
                        ColumnDef::new(Tournament::ScheduledStart, ColumnType::TimestampWithTimeZone).null()
                    )
                    .to_owned(),
            )
            .await
    }

    async fn down(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .alter_table(
                Table::alter()
                    .table(Tournament::Table)
                    .drop_column(Tournament::ScheduledStart)
                    .to_owned(),
            )
            .await
    }
}

#[derive(Iden)]
pub enum Tournament {
    Table,
    #[iden = "scheduled_start"]
    ScheduledStart,
}

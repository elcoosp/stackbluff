use sea_orm_migration::prelude::*;

#[derive(DeriveMigrationName)]
pub struct Migration;

#[async_trait::async_trait]
impl MigrationTrait for Migration {
    async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .alter_table(
                Table::alter()
                    .table(Tournaments::Table)
                    .add_column(
                        Column::new(Tournaments::ScheduledStart)
                            .timestamp_with_time_zone()
                            .null(),
                    )
                    .to_owned(),
            )
            .await
    }

    async fn down(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .alter_table(
                Table::alter()
                    .table(Tournaments::Table)
                    .drop_column(Tournaments::ScheduledStart)
                    .to_owned(),
            )
            .await
    }
}

#[derive(DeriveIden)]
enum Tournaments {
    Table,
    ScheduledStart,
}

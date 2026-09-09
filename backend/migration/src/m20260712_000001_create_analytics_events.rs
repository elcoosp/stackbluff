use sea_orm_migration::prelude::*;

#[derive(DeriveMigrationName)]
pub struct Migration;

#[async_trait::async_trait]
impl MigrationTrait for Migration {
    async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .create_table(
                Table::create()
                    .table(AnalyticsEvents::Table)
                    .if_not_exists()
                    .col(
                        ColumnDef::new(AnalyticsEvents::Id)
                            .uuid()
                            .not_null()
                            .primary_key(),
                    )
                    .col(ColumnDef::new(AnalyticsEvents::UserId).uuid().not_null())
                    .col(
                        ColumnDef::new(AnalyticsEvents::EventType)
                            .string()
                            .not_null(),
                    )
                    .col(
                        ColumnDef::new(AnalyticsEvents::PayloadJson)
                            .json_binary()
                            .not_null(),
                    )
                    .col(
                        ColumnDef::new(AnalyticsEvents::CreatedAt)
                            .timestamp_with_time_zone()
                            .not_null()
                            .default(Expr::current_timestamp()),
                    )
                    .to_owned(),
            )
            .await
    }

    async fn down(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .drop_table(Table::drop().table(AnalyticsEvents::Table).to_owned())
            .await
    }
}

#[derive(DeriveIden)]
enum AnalyticsEvents {
    Table,
    Id,
    UserId,
    EventType,
    PayloadJson,
    CreatedAt,
}

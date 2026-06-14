use sea_orm_migration::prelude::*;

#[derive(DeriveMigrationName)]
pub struct Migration;

#[async_trait::async_trait]
impl MigrationTrait for Migration {
    async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .create_table(
                Table::create()
                    .table(PaymentIntents::Table)
                    .if_not_exists()
                    .col(
                        ColumnDef::new(PaymentIntents::Id)
                            .uuid()
                            .not_null()
                            .primary_key(),
                    )
                    .col(
                        ColumnDef::new(PaymentIntents::PaymentId)
                            .string()
                            .not_null(),
                    )
                    .col(ColumnDef::new(PaymentIntents::UserId).uuid().not_null())
                    .col(
                        ColumnDef::new(PaymentIntents::Amount)
                            .big_integer()
                            .not_null(),
                    )
                    .col(ColumnDef::new(PaymentIntents::Currency).string().not_null())
                    .col(ColumnDef::new(PaymentIntents::Status).string().not_null())
                    .col(ColumnDef::new(PaymentIntents::Provider).string().not_null())
                    .col(
                        ColumnDef::new(PaymentIntents::CreatedAt)
                            .timestamp_with_time_zone()
                            .not_null(),
                    )
                    .col(
                        ColumnDef::new(PaymentIntents::UpdatedAt)
                            .timestamp_with_time_zone()
                            .not_null(),
                    )
                    .col(ColumnDef::new(PaymentIntents::CompletedAt).timestamp_with_time_zone())
                    .col(
                        ColumnDef::new(PaymentIntents::Metadata)
                            .json_binary()
                            .not_null(),
                    )
                    .index(
                        Index::create()
                            .name("idx_payment_intents_payment_id")
                            .col(PaymentIntents::PaymentId)
                            .unique(),
                    )
                    .index(
                        Index::create()
                            .name("idx_payment_intents_user_status")
                            .col(PaymentIntents::UserId)
                            .col(PaymentIntents::Status),
                    )
                    .to_owned(),
            )
            .await
    }

    async fn down(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .drop_table(Table::drop().table(PaymentIntents::Table).to_owned())
            .await
    }
}

#[derive(Iden)]
enum PaymentIntents {
    Table,
    Id,
    PaymentId,
    UserId,
    Amount,
    Currency,
    Status,
    Provider,
    CreatedAt,
    UpdatedAt,
    CompletedAt,
    Metadata,
}

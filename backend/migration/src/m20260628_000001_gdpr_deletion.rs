use sea_orm_migration::prelude::*;

#[derive(DeriveMigrationName)]
pub struct Migration;

#[async_trait::async_trait]
impl MigrationTrait for Migration {
    async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .create_table(
                Table::create()
                    .table(DeletionRequests::Table)
                    .if_not_exists()
                    .col(ColumnDef::new(DeletionRequests::UserId).uuid().not_null().primary_key())
                    .col(ColumnDef::new(DeletionRequests::RequestedAt).timestamp().not_null())
                    .col(ColumnDef::new(DeletionRequests::Status).text().not_null().default("pending"))
                    .col(ColumnDef::new(DeletionRequests::ProcessedAt).timestamp())
                    .col(ColumnDef::new(DeletionRequests::Reason).text())
                    .foreign_key(
                        ForeignKey::create()
                            .name("fk-deletion-requests-user-id")
                            .from(DeletionRequests::Table, DeletionRequests::UserId)
                            .to(Users::Table, Users::Id)
                            .on_delete(ForeignKeyAction::Cascade),
                    )
                    .to_owned(),
            )
            .await?;

        manager
            .alter_table(
                Table::alter()
                    .table(Users::Table)
                    .add_column(ColumnDef::new(Users::DeletedAt).timestamp())
                    .to_owned(),
            )
            .await?;

        Ok(())
    }

    async fn down(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .alter_table(
                Table::alter()
                    .table(Users::Table)
                    .drop_column(Users::DeletedAt)
                    .to_owned(),
            )
            .await?;

        manager
            .drop_table(Table::drop().table(DeletionRequests::Table).to_owned())
            .await?;

        Ok(())
    }
}

#[derive(DeriveIden)]
enum DeletionRequests {
    Table,
    UserId,
    RequestedAt,
    Status,
    ProcessedAt,
    Reason,
}

#[derive(DeriveIden)]
enum Users {
    Table,
    Id,
    DeletedAt,
}

use sea_orm_migration::prelude::*;

#[derive(DeriveMigrationName)]
pub struct Migration;

#[async_trait::async_trait]
impl MigrationTrait for Migration {
    async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .create_table(
                Table::create()
                    .table(DeviceFingerprint::Table)
                    .if_not_exists()
                    .col(
                        ColumnDef::new(DeviceFingerprint::UserId)
                            .uuid()
                            .not_null(),
                    )
                    .col(
                        ColumnDef::new(DeviceFingerprint::FingerprintHash)
                            .string()
                            .not_null(),
                    )
                    .col(
                        ColumnDef::new(DeviceFingerprint::Ip)
                            .string()
                            .not_null(),
                    )
                    .col(
                        ColumnDef::new(DeviceFingerprint::CreatedAt)
                            .date_time()
                            .not_null(),
                    )
                    .primary_key(
                        Index::create()
                            .col(DeviceFingerprint::UserId)
                            .col(DeviceFingerprint::FingerprintHash),
                    )
                    .to_owned(),
            )
            .await
    }

    async fn down(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .drop_table(Table::drop().table(DeviceFingerprint::Table).to_owned())
            .await
    }
}

#[derive(DeriveIden)]
enum DeviceFingerprint {
    Table,
    UserId,
    FingerprintHash,
    Ip,
    CreatedAt,
}

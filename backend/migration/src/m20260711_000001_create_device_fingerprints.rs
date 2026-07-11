use sea_orm_migration::prelude::*;

#[derive(DeriveMigrationName)]
pub struct Migration;

#[async_trait::async_trait]
impl MigrationTrait for Migration {
    async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .create_table(
                Table::create()
                    .table(DeviceFingerprints::Table)
                    .if_not_exists()
                    .col(
                        ColumnDef::new(DeviceFingerprints::Id)
                            .integer()
                            .not_null()
                            .auto_increment()
                            .primary_key(),
                    )
                    .col(
                        ColumnDef::new(DeviceFingerprints::UserId)
                            .uuid()
                            .not_null(),
                    )
                    .col(
                        ColumnDef::new(DeviceFingerprints::FingerprintHash)
                            .string()
                            .not_null(),
                    )
                    .col(
                        ColumnDef::new(DeviceFingerprints::Ip)
                            .string()
                            .not_null(),
                    )
                    .col(
                        ColumnDef::new(DeviceFingerprints::CreatedAt)
                            .date_time()
                            .not_null(),
                    )
                    .to_owned(),
            )
            .await
    }

    async fn down(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .drop_table(Table::drop().table(DeviceFingerprints::Table).to_owned())
            .await
    }
}

#[derive(DeriveIden)]
enum DeviceFingerprints {
    Table,
    Id,
    UserId,
    FingerprintHash,
    Ip,
    CreatedAt,
}

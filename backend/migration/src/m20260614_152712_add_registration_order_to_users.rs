use sea_orm_migration::prelude::*;

#[derive(DeriveMigrationName)]
pub struct Migration;

#[async_trait::async_trait]
impl MigrationTrait for Migration {
    async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .alter_table(
                Table::alter()
                    .table(Alias::new("users")) // Fixed: use "users" explicitly
                    .add_column(
                        ColumnDef::new(Alias::new("registration_order"))
                            .big_integer()
                            .null(),
                    )
                    .to_owned(),
            )
            .await?;
        Ok(())
    }

    async fn down(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .alter_table(
                Table::alter()
                    .table(Alias::new("users")) // Fixed: use "users" explicitly
                    .drop_column(Alias::new("registration_order"))
                    .to_owned(),
            )
            .await?;
        Ok(())
    }
}

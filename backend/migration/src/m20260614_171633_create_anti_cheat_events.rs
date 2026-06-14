use sea_orm_migration::prelude::*;

#[derive(DeriveMigrationName)]
pub struct Migration;

#[async_trait::async_trait]
impl MigrationTrait for Migration {
    async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .create_table(
                Table::create()
                    .table(AntiCheatEvents::Table)
                    .if_not_exists()
                    .col(
                        ColumnDef::new(AntiCheatEvents::Id)
                            .big_integer()
                            .not_null()
                            .auto_increment()
                            .primary_key(),
                    )
                    .col(ColumnDef::new(AntiCheatEvents::UserIds).string().not_null())
                    .col(ColumnDef::new(AntiCheatEvents::Ip).string())
                    .col(
                        ColumnDef::new(AntiCheatEvents::EventType)
                            .string()
                            .not_null(),
                    )
                    .col(ColumnDef::new(AntiCheatEvents::Details).string())
                    .col(
                        ColumnDef::new(AntiCheatEvents::CreatedAt)
                            .timestamp()
                            .not_null(),
                    )
                    .to_owned(),
            )
            .await
    }

    async fn down(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .drop_table(Table::drop().table(AntiCheatEvents::Table).to_owned())
            .await
    }
}

#[derive(Iden)]
pub enum AntiCheatEvents {
    Table,
    Id,
    UserIds,
    Ip,
    EventType,
    Details,
    CreatedAt,
}

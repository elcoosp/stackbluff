use sea_orm_migration::prelude::*;

#[derive(DeriveMigrationName)]
pub struct Migration;

#[async_trait::async_trait]
impl MigrationTrait for Migration {
    async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .create_table(
                Table::create()
                    .table(Tournaments::Table)
                    .if_not_exists()
                    .col(
                        ColumnDef::new(Tournaments::Id)
                            .uuid()
                            .not_null()
                            .primary_key(),
                    )
                    .col(ColumnDef::new(Tournaments::ConfigJson).json().not_null())
                    .col(
                        ColumnDef::new(Tournaments::Status)
                            .string()
                            .not_null()
                            .default("Registering"),
                    )
                    .col(
                        ColumnDef::new(Tournaments::PrizePool)
                            .big_integer()
                            .not_null()
                            .default(0),
                    )
                    .col(ColumnDef::new(Tournaments::StartedAt).date_time())
                    .col(ColumnDef::new(Tournaments::CompletedAt).date_time())
                    .col(
                        ColumnDef::new(Tournaments::CreatedAt)
                            .date_time()
                            .not_null()
                            .extra("DEFAULT CURRENT_TIMESTAMP"),
                    )
                    .to_owned(),
            )
            .await?;

        manager
            .create_table(
                Table::create()
                    .table(TournamentRegistrations::Table)
                    .if_not_exists()
                    .col(
                        ColumnDef::new(TournamentRegistrations::Id)
                            .uuid()
                            .not_null()
                            .primary_key(),
                    )
                    .col(
                        ColumnDef::new(TournamentRegistrations::TournamentId)
                            .uuid()
                            .not_null(),
                    )
                    .col(
                        ColumnDef::new(TournamentRegistrations::UserId)
                            .uuid()
                            .not_null(),
                    )
                    .col(
                        ColumnDef::new(TournamentRegistrations::BuyIn)
                            .big_integer()
                            .not_null(),
                    )
                    .col(
                        ColumnDef::new(TournamentRegistrations::RegisteredAt)
                            .date_time()
                            .not_null()
                            .extra("DEFAULT CURRENT_TIMESTAMP"),
                    )
                    .index(
                        Index::create()
                            .unique()
                            .name("idx_tournament_reg_unique")
                            .col(TournamentRegistrations::TournamentId)
                            .col(TournamentRegistrations::UserId),
                    )
                    .to_owned(),
            )
            .await?;

        manager
            .create_table(
                Table::create()
                    .table(TournamentResults::Table)
                    .if_not_exists()
                    .col(
                        ColumnDef::new(TournamentResults::Id)
                            .uuid()
                            .not_null()
                            .primary_key(),
                    )
                    .col(
                        ColumnDef::new(TournamentResults::TournamentId)
                            .uuid()
                            .not_null(),
                    )
                    .col(ColumnDef::new(TournamentResults::UserId).uuid().not_null())
                    .col(
                        ColumnDef::new(TournamentResults::Position)
                            .integer()
                            .not_null(),
                    )
                    .col(
                        ColumnDef::new(TournamentResults::Prize)
                            .big_integer()
                            .not_null(),
                    )
                    .col(
                        ColumnDef::new(TournamentResults::CompletedAt)
                            .date_time()
                            .not_null(),
                    )
                    .to_owned(),
            )
            .await?;

        Ok(())
    }

    async fn down(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .drop_table(Table::drop().table(TournamentResults::Table).to_owned())
            .await?;
        manager
            .drop_table(
                Table::drop()
                    .table(TournamentRegistrations::Table)
                    .to_owned(),
            )
            .await?;
        manager
            .drop_table(Table::drop().table(Tournaments::Table).to_owned())
            .await?;
        Ok(())
    }
}

#[derive(DeriveIden)]
enum Tournaments {
    Table,
    Id,
    ConfigJson,
    Status,
    PrizePool,
    StartedAt,
    CompletedAt,
    CreatedAt,
}

#[derive(DeriveIden)]
enum TournamentRegistrations {
    Table,
    Id,
    TournamentId,
    UserId,
    BuyIn,
    RegisteredAt,
}

#[derive(DeriveIden)]
enum TournamentResults {
    Table,
    Id,
    TournamentId,
    UserId,
    Position,
    Prize,
    CompletedAt,
}

use sea_orm_migration::prelude::*;

#[derive(DeriveMigrationName)]
pub struct Migration;

#[async_trait::async_trait]
impl MigrationTrait for Migration {
    async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .create_table(
                Table::create()
                    .table(UserSeasonCards::Table)
                    .if_not_exists()
                    .col(ColumnDef::new(UserSeasonCards::UserId).uuid().not_null())
                    .col(ColumnDef::new(UserSeasonCards::SeasonId).integer().not_null())
                    .col(ColumnDef::new(UserSeasonCards::CardImageUrl).string().null())
                    .col(ColumnDef::new(UserSeasonCards::CardData).json().null())
                    .col(
                        ColumnDef::new(UserSeasonCards::GeneratedAt)
                            .timestamp_with_time_zone()
                            .not_null()
                            .default(Expr::current_timestamp()),
                    )
                    .primary_key(
                        Index::create()
                            .col(UserSeasonCards::UserId)
                            .col(UserSeasonCards::SeasonId),
                    )
                    .foreign_key(
                        ForeignKey::create()
                            .name("fk_user_season_cards_user_id")
                            .from(UserSeasonCards::Table, UserSeasonCards::UserId)
                            .to(Users::Table, Users::Id)
                            .on_delete(ForeignKeyAction::Cascade),
                    )
                    .foreign_key(
                        ForeignKey::create()
                            .name("fk_user_season_cards_season_id")
                            .from(UserSeasonCards::Table, UserSeasonCards::SeasonId)
                            .to(Seasons::Table, Seasons::Id)
                            .on_delete(ForeignKeyAction::Cascade),
                    )
                    .to_owned(),
            )
            .await
    }

    async fn down(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .drop_table(Table::drop().table(UserSeasonCards::Table).to_owned())
            .await
    }
}

#[derive(DeriveIden)]
enum UserSeasonCards {
    Table,
    UserId,
    SeasonId,
    CardImageUrl,
    CardData,
    GeneratedAt,
}

#[derive(DeriveIden)]
enum Users {
    Table,
    Id,
}

#[derive(DeriveIden)]
enum Seasons {
    Table,
    Id,
}

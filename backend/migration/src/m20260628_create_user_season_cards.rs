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
                    .col(
                        ColumnDef::new(UserSeasonCards::UserId)
                            .uuid()
                            .not_null(),
                    )
                    .col(
                        ColumnDef::new(UserSeasonCards::SeasonId)
                            .integer()
                            .not_null(),
                    )
                    .col(ColumnDef::new(UserSeasonCards::CardImageUrl).text())
                    .col(ColumnDef::new(UserSeasonCards::CardData).json_binary())
                    .col(
                        ColumnDef::new(UserSeasonCards::GeneratedAt)
                            .timestamp_with_time_zone()
                            .not_null()
                            .extra("DEFAULT NOW()".to_string()),
                    )
                    .primary_key(
                        Index::create()
                            .name("pk_user_season_cards")
                            .col(UserSeasonCards::UserId)
                            .col(UserSeasonCards::SeasonId),
                    )
                    .foreign_key(
                        ForeignKey::create()
                            .name("fk_usc_user_id")
                            .from(UserSeasonCards::Table, UserSeasonCards::UserId)
                            .to(Users::Table, Users::Id)
                            .on_delete(ForeignKeyAction::Cascade),
                    )
                    .foreign_key(
                        ForeignKey::create()
                            .name("fk_usc_season_id")
                            .from(UserSeasonCards::Table, UserSeasonCards::SeasonId)
                            .to(Seasons::Table, Seasons::Id)
                            .on_delete(ForeignKeyAction::Cascade),
                    )
                    .to_owned(),
            )
            .await?;

        manager
            .alter_table(
                Table::alter()
                    .table(Seasons::Table)
                    .add_column(
                        ColumnDef::new(Seasons::Processed)
                            .boolean()
                            .not_null()
                            .default(false),
                    )
                    .to_owned(),
            )
            .await
    }

    async fn down(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .alter_table(
                Table::alter()
                    .table(Seasons::Table)
                    .drop_column(Seasons::Processed)
                    .to_owned(),
            )
            .await?;

        manager
            .drop_table(Table::drop().table(UserSeasonCards::Table).to_owned())
            .await
    }
}

#[derive(Iden)]
enum UserSeasonCards {
    Table,
    UserId,
    SeasonId,
    CardImageUrl,
    CardData,
    GeneratedAt,
}

#[derive(Iden)]
enum Users {
    Table,
    Id,
}

#[derive(Iden)]
enum Seasons {
    Table,
    Id,
    Processed,
}

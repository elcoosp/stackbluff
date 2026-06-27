use sea_orm_migration::prelude::*;

#[derive(DeriveMigrationName)]
pub struct Migration;

#[async_trait::async_trait]
impl MigrationTrait for Migration {
    async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .create_table(
                Table::create()
                    .table(PuzzleSubmissions::Table)
                    .if_not_exists()
                    .col(ColumnDef::new(PuzzleSubmissions::UserId).uuid().not_null())
                    .col(ColumnDef::new(PuzzleSubmissions::PuzzleDate).date().not_null())
                    .col(ColumnDef::new(PuzzleSubmissions::SelectedAction).text().not_null())
                    .col(ColumnDef::new(PuzzleSubmissions::IsCorrect).boolean().not_null())
                    .col(ColumnDef::new(PuzzleSubmissions::SubmittedAt).timestamp().not_null().default(Expr::current_timestamp()))
                    .primary_key(Index::create().col(PuzzleSubmissions::UserId).col(PuzzleSubmissions::PuzzleDate))
                    .to_owned(),
            )
            .await
    }

    async fn down(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager.drop_table(Table::drop().table(PuzzleSubmissions::Table).to_owned()).await
    }
}

#[derive(DeriveIden)]
enum PuzzleSubmissions { Table, UserId, PuzzleDate, SelectedAction, IsCorrect, SubmittedAt }

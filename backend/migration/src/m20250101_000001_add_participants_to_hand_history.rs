use sea_orm_migration::prelude::*;

pub struct Migration;

impl MigrationName for Migration {
    fn name(&self) -> &str {
        "m20250101_000001_add_participants_to_hand_history"
    }
}

#[async_trait::async_trait]
impl MigrationTrait for Migration {
    async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .alter_table(
                Table::alter()
                    .table(HandHistory::Table)
                    .add_column_if_not_exists(
                        ColumnDef::new(HandHistory::Participants)
                            .text()
                            .not_null()
                            .default(","),
                    )
                    .to_owned(),
            )
            .await
    }

    async fn down(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .alter_table(
                Table::alter()
                    .table(HandHistory::Table)
                    .drop_column(HandHistory::Participants)
                    .to_owned(),
            )
            .await
    }
}

#[derive(Iden)]
pub enum HandHistory {
    Table,
    Participants,
}

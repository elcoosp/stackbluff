use sea_orm_migration::prelude::*;

pub struct Migration;

impl MigrationName for Migration {
    fn name(&self) -> &str {
        "m20260717_add_chip_committed_to_registrations"
    }
}

/// B-3/B-8 follow-up: track whether a registration's buy-in was actually
/// debited from the player's wallet. Crash recovery uses this flag to
/// refund only registrations that actually paid — the previous version
/// refunded every row, minting chips for free registrations.
#[async_trait::async_trait]
impl MigrationTrait for Migration {
    async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .alter_table(
                Table::alter()
                    .table(Alias::new("tournament_registrations"))
                    .add_column(
                        ColumnDef::new(Alias::new("chip_committed"))
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
                    .table(Alias::new("tournament_registrations"))
                    .drop_column(Alias::new("chip_committed"))
                    .to_owned(),
            )
            .await
    }
}

use sea_orm_migration::prelude::*;

#[derive(DeriveMigrationName)]
pub struct Migration;

#[async_trait::async_trait]
impl MigrationTrait for Migration {
    async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .create_index(
                Index::create()
                    .name("idx_referrals_referrer_id")
                    .table(Referral::Table)
                    .col(Referral::ReferrerId)
                    .to_owned(),
            )
            .await?;
        Ok(())
    }
    async fn down(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .drop_index(Index::drop().name("idx_referrals_referrer_id").table(Referral::Table))
            .await?;
        Ok(())
    }
}

#[derive(DeriveIden)]
enum Referral {
    Table,
    ReferrerId,
}

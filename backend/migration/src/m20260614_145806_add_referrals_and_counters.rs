use sea_orm_migration::prelude::*;

#[derive(DeriveMigrationName)]
pub struct Migration;

#[async_trait::async_trait]
impl MigrationTrait for Migration {
    async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager.create_table(
            Table::create()
                .table(Referral::Table)
                .if_not_exists()
                .col(ColumnDef::new(Referral::Id).integer().not_null().auto_increment().primary_key())
                .col(ColumnDef::new(Referral::ReferrerId).string().not_null())
                .col(ColumnDef::new(Referral::ReferredId).string().not_null().unique_key())
                .col(ColumnDef::new(Referral::HandCount).integer().not_null().default(0))
                .col(ColumnDef::new(Referral::BonusAwarded).boolean().not_null().default(false))
                .col(ColumnDef::new(Referral::CreatedAt).timestamp().not_null())
                .to_owned()
        ).await?;
        manager.create_table(
            Table::create()
                .table(SystemCounter::Table)
                .if_not_exists()
                .col(ColumnDef::new(SystemCounter::Id).integer().not_null().auto_increment().primary_key())
                .col(ColumnDef::new(SystemCounter::Name).string().not_null().unique_key())
                .col(ColumnDef::new(SystemCounter::Value).big_integer().not_null().default(0))
                .to_owned()
        ).await?;
        let insert = Query::insert()
            .into_table(SystemCounter::Table)
            .columns([SystemCounter::Name, SystemCounter::Value])
            .values_panic(["global_user_count".into(), 0.into()])
            .to_owned();
        manager.exec_stmt(insert).await?;
        Ok(())
    }
    async fn down(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager.drop_table(Table::drop().table(Referral::Table).to_owned()).await?;
        manager.drop_table(Table::drop().table(SystemCounter::Table).to_owned()).await?;
        Ok(())
    }
}
#[derive(DeriveIden)]
enum Referral { Table, Id, ReferrerId, ReferredId, HandCount, BonusAwarded, CreatedAt }
#[derive(DeriveIden)]
enum SystemCounter { Table, Id, Name, Value }

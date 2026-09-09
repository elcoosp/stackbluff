use sea_orm_migration::prelude::*;

#[derive(DeriveMigrationName)]
pub struct Migration;

#[async_trait::async_trait]
impl MigrationTrait for Migration {
    async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .create_table(
                Table::create()
                    .table(UserBadges::Table)
                    .if_not_exists()
                    .col(ColumnDef::new(UserBadges::UserId).uuid().not_null())
                    .col(
                        ColumnDef::new(UserBadges::BadgeType)
                            .string_len(32)
                            .not_null(),
                    )
                    .col(
                        ColumnDef::new(UserBadges::AwardedAt)
                            .timestamp_with_time_zone()
                            .not_null()
                            .default(Expr::current_timestamp()),
                    )
                    .primary_key(
                        Index::create()
                            .col(UserBadges::UserId)
                            .col(UserBadges::BadgeType),
                    )
                    .foreign_key(
                        ForeignKey::create()
                            .from(UserBadges::Table, UserBadges::UserId)
                            .to(Users::Table, Users::Id)
                            .on_delete(ForeignKeyAction::Cascade)
                            .on_update(ForeignKeyAction::Cascade),
                    )
                    .check(Expr::col(UserBadges::BadgeType).is_in(["founding_member"]))
                    .to_owned(),
            )
            .await?;

        manager
            .create_index(
                Index::create()
                    .if_not_exists()
                    .name("idx_user_badges_user_id")
                    .table(UserBadges::Table)
                    .col(UserBadges::UserId)
                    .to_owned(),
            )
            .await
    }

    async fn down(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .drop_table(Table::drop().table(UserBadges::Table).to_owned())
            .await
    }
}

#[derive(DeriveIden)]
pub enum UserBadges {
    Table,
    UserId,
    BadgeType,
    AwardedAt,
}

#[derive(DeriveIden)]
pub enum Users {
    Table,
    Id,
}

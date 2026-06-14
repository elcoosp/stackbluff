use sb_db_entities::{
    Platform, RankTier, SubscriptionEventType, TableStatus, club_memberships, clubs, hand_history,
    leaderboard_global_mv, mission_completion, player_rank, referral, season, session,
    subscription_event, table, user,
};
use sea_orm_migration::{
    prelude::*,
    sea_orm::{ActiveEnum, Iterable},
};

#[derive(DeriveMigrationName)]
pub struct Migration;

#[async_trait::async_trait]
impl MigrationTrait for Migration {
    async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        // Enable WAL mode for better concurrency (ADR-002)
        manager
            .get_connection()
            .execute_unprepared("PRAGMA journal_mode=WAL;")
            .await?;
        manager
            .get_connection()
            .execute_unprepared("PRAGMA foreign_keys = ON")
            .await?;

        // Users table with CHECK constraint inline
        manager
            .create_table(
                Table::create()
                    .table(user::Entity)
                    .if_not_exists()
                    .col(
                        ColumnDef::new(user::Column::Id)
                            .uuid()
                            .not_null()
                            .primary_key(),
                    )
                    .col(ColumnDef::new(user::Column::TelegramId).big_integer())
                    .col(ColumnDef::new(user::Column::Email).string().unique_key())
                    .col(
                        ColumnDef::new(user::Column::DisplayName)
                            .string()
                            .not_null(),
                    )
                    .col(
                        ColumnDef::new(user::Column::ChipBalance)
                            .big_integer()
                            .not_null()
                            .default(0),
                    )
                    .col(
                        ColumnDef::new(user::Column::StreakCount)
                            .integer()
                            .not_null()
                            .default(0),
                    )
                    .col(
                        ColumnDef::new(user::Column::CreatedAt)
                            .date_time()
                            .not_null(),
                    )
                    .col(
                        ColumnDef::new(user::Column::UpdatedAt)
                            .date_time()
                            .not_null(),
                    )
                    .col(
                        ColumnDef::new(user::Column::Platform)
                            .enumeration(
                                Platform::name(),
                                Platform::iter().map(|v| v.to_value()).collect::<Vec<_>>(),
                            )
                            .not_null()
                            .default(Platform::Pwa.to_value()),
                    )
                    .col(ColumnDef::new(user::Column::EmailVerifiedAt).date_time())
                    .check(Expr::col(user::Column::ChipBalance).gte(0))
                    .to_owned(),
            )
            .await?;

        // Sessions table
        manager
            .create_table(
                Table::create()
                    .table(session::Entity)
                    .if_not_exists()
                    .col(
                        ColumnDef::new(session::Column::TokenHash)
                            .string()
                            .not_null()
                            .primary_key(),
                    )
                    .col(ColumnDef::new(session::Column::UserId).uuid().not_null())
                    .col(
                        ColumnDef::new(session::Column::ExpiresAt)
                            .date_time()
                            .not_null(),
                    )
                    .col(
                        ColumnDef::new(session::Column::CreatedAt)
                            .date_time()
                            .not_null(),
                    )
                    .foreign_key(
                        ForeignKey::create()
                            .from(session::Entity, session::Column::UserId)
                            .to(user::Entity, user::Column::Id)
                            .on_delete(ForeignKeyAction::Cascade),
                    )
                    .to_owned(),
            )
            .await?;

        // Seasons table
        manager
            .create_table(
                Table::create()
                    .table(season::Entity)
                    .if_not_exists()
                    .col(
                        ColumnDef::new(season::Column::Id)
                            .integer()
                            .not_null()
                            .primary_key(),
                    )
                    .col(ColumnDef::new(season::Column::Name).string().not_null())
                    .col(
                        ColumnDef::new(season::Column::StartsAt)
                            .date_time()
                            .not_null(),
                    )
                    .col(
                        ColumnDef::new(season::Column::EndsAt)
                            .date_time()
                            .not_null(),
                    )
                    .to_owned(),
            )
            .await?;

        // Player ranks
        manager
            .create_table(
                Table::create()
                    .table(player_rank::Entity)
                    .if_not_exists()
                    .col(
                        ColumnDef::new(player_rank::Column::UserId)
                            .uuid()
                            .not_null(),
                    )
                    .col(
                        ColumnDef::new(player_rank::Column::SeasonId)
                            .integer()
                            .not_null(),
                    )
                    .col(
                        ColumnDef::new(player_rank::Column::RankTier)
                            .enumeration(
                                RankTier::name(),
                                RankTier::iter().map(|v| v.to_value()).collect::<Vec<_>>(),
                            )
                            .not_null(),
                    )
                    .col(
                        ColumnDef::new(player_rank::Column::RankPoints)
                            .integer()
                            .not_null(),
                    )
                    .primary_key(
                        Index::create()
                            .col(player_rank::Column::UserId)
                            .col(player_rank::Column::SeasonId),
                    )
                    .foreign_key(
                        ForeignKey::create()
                            .from(player_rank::Entity, player_rank::Column::UserId)
                            .to(user::Entity, user::Column::Id)
                            .on_delete(ForeignKeyAction::Cascade),
                    )
                    .foreign_key(
                        ForeignKey::create()
                            .from(player_rank::Entity, player_rank::Column::SeasonId)
                            .to(season::Entity, season::Column::Id)
                            .on_delete(ForeignKeyAction::Cascade),
                    )
                    .to_owned(),
            )
            .await?;

        // Clubs table
        manager
            .create_table(
                Table::create()
                    .table(clubs::Entity)
                    .if_not_exists()
                    .col(
                        ColumnDef::new(clubs::Column::Id)
                            .uuid()
                            .not_null()
                            .primary_key(),
                    )
                    .col(ColumnDef::new(clubs::Column::OwnerId).uuid().not_null())
                    .col(ColumnDef::new(clubs::Column::Name).string().not_null())
                    .col(
                        ColumnDef::new(clubs::Column::CreatedAt)
                            .date_time()
                            .not_null(),
                    )
                    .col(
                        ColumnDef::new(clubs::Column::IsFounderClub)
                            .boolean()
                            .not_null()
                            .default(false),
                    )
                    .col(ColumnDef::new(clubs::Column::ProSettingsJson).json())
                    .foreign_key(
                        ForeignKey::create()
                            .from(clubs::Entity, clubs::Column::OwnerId)
                            .to(user::Entity, user::Column::Id)
                            .on_delete(ForeignKeyAction::Cascade),
                    )
                    .to_owned(),
            )
            .await?;

        // Club memberships
        manager
            .create_table(
                Table::create()
                    .table(club_memberships::Entity)
                    .if_not_exists()
                    .col(
                        ColumnDef::new(club_memberships::Column::Id)
                            .uuid()
                            .not_null()
                            .primary_key(),
                    )
                    .col(
                        ColumnDef::new(club_memberships::Column::ClubId)
                            .uuid()
                            .not_null(),
                    )
                    .col(
                        ColumnDef::new(club_memberships::Column::UserId)
                            .uuid()
                            .not_null(),
                    )
                    .col(
                        ColumnDef::new(club_memberships::Column::WeeklyXp)
                            .big_integer()
                            .not_null()
                            .default(0),
                    )
                    .col(
                        ColumnDef::new(club_memberships::Column::JoinedAt)
                            .date_time()
                            .not_null(),
                    )
                    .col(
                        ColumnDef::new(club_memberships::Column::UpdatedAt)
                            .date_time()
                            .not_null(),
                    )
                    .foreign_key(
                        ForeignKey::create()
                            .from(club_memberships::Entity, club_memberships::Column::UserId)
                            .to(user::Entity, user::Column::Id)
                            .on_delete(ForeignKeyAction::Cascade),
                    )
                    .foreign_key(
                        ForeignKey::create()
                            .from(club_memberships::Entity, club_memberships::Column::ClubId)
                            .to(clubs::Entity, clubs::Column::Id)
                            .on_delete(ForeignKeyAction::Cascade),
                    )
                    .to_owned(),
            )
            .await?;

        // Tables
        manager
            .create_table(
                Table::create()
                    .table(table::Entity)
                    .if_not_exists()
                    .col(
                        ColumnDef::new(table::Column::Id)
                            .uuid()
                            .not_null()
                            .primary_key(),
                    )
                    .col(ColumnDef::new(table::Column::CreatedBy).uuid().not_null())
                    .col(ColumnDef::new(table::Column::ConfigJson).json().not_null())
                    .col(
                        ColumnDef::new(table::Column::Status)
                            .enumeration(
                                TableStatus::name(),
                                TableStatus::iter()
                                    .map(|v| v.to_value())
                                    .collect::<Vec<_>>(),
                            )
                            .not_null(),
                    )
                    .col(ColumnDef::new(table::Column::ClubId).uuid())
                    .col(
                        ColumnDef::new(table::Column::CreatedAt)
                            .date_time()
                            .not_null(),
                    )
                    .foreign_key(
                        ForeignKey::create()
                            .from(table::Entity, table::Column::CreatedBy)
                            .to(user::Entity, user::Column::Id),
                    )
                    .foreign_key(
                        ForeignKey::create()
                            .from(table::Entity, table::Column::ClubId)
                            .to(clubs::Entity, clubs::Column::Id)
                            .on_delete(ForeignKeyAction::SetNull),
                    )
                    .to_owned(),
            )
            .await?;

        // Hand history
        manager
            .create_table(
                Table::create()
                    .table(hand_history::Entity)
                    .if_not_exists()
                    .col(
                        ColumnDef::new(hand_history::Column::Id)
                            .uuid()
                            .not_null()
                            .primary_key(),
                    )
                    .col(
                        ColumnDef::new(hand_history::Column::TableId)
                            .uuid()
                            .not_null(),
                    )
                    .col(
                        ColumnDef::new(hand_history::Column::PlayedAt)
                            .date_time()
                            .not_null(),
                    )
                    .col(
                        ColumnDef::new(hand_history::Column::PlayersJson)
                            .json()
                            .not_null(),
                    )
                    .col(
                        ColumnDef::new(hand_history::Column::ActionsJson)
                            .json()
                            .not_null(),
                    )
                    .col(
                        ColumnDef::new(hand_history::Column::ResultJson)
                            .json()
                            .not_null(),
                    )
                    .col(
                        ColumnDef::new(hand_history::Column::IsArchived)
                            .boolean()
                            .not_null()
                            .default(false),
                    )
                    .foreign_key(
                        ForeignKey::create()
                            .from(hand_history::Entity, hand_history::Column::TableId)
                            .to(table::Entity, table::Column::Id)
                            .on_delete(ForeignKeyAction::Cascade),
                    )
                    .to_owned(),
            )
            .await?;

        // Subscription events
        manager
            .create_table(
                Table::create()
                    .table(subscription_event::Entity)
                    .if_not_exists()
                    .col(
                        ColumnDef::new(subscription_event::Column::Id)
                            .uuid()
                            .not_null()
                            .primary_key(),
                    )
                    .col(
                        ColumnDef::new(subscription_event::Column::UserId)
                            .uuid()
                            .not_null(),
                    )
                    .col(
                        ColumnDef::new(subscription_event::Column::Product)
                            .string()
                            .not_null(),
                    )
                    .col(
                        ColumnDef::new(subscription_event::Column::EventType)
                            .enumeration(
                                SubscriptionEventType::name(),
                                SubscriptionEventType::iter()
                                    .map(|v| v.to_value())
                                    .collect::<Vec<_>>(),
                            )
                            .not_null(),
                    )
                    .col(
                        ColumnDef::new(subscription_event::Column::OccurredAt)
                            .date_time()
                            .not_null(),
                    )
                    .col(ColumnDef::new(subscription_event::Column::PaymentId).string())
                    .foreign_key(
                        ForeignKey::create()
                            .from(
                                subscription_event::Entity,
                                subscription_event::Column::UserId,
                            )
                            .to(user::Entity, user::Column::Id)
                            .on_delete(ForeignKeyAction::Cascade),
                    )
                    .to_owned(),
            )
            .await?;

        // Mission completions
        manager
            .create_table(
                Table::create()
                    .table(mission_completion::Entity)
                    .if_not_exists()
                    .col(
                        ColumnDef::new(mission_completion::Column::UserId)
                            .uuid()
                            .not_null(),
                    )
                    .col(
                        ColumnDef::new(mission_completion::Column::MissionType)
                            .string()
                            .not_null(),
                    )
                    .col(
                        ColumnDef::new(mission_completion::Column::CompletedDate)
                            .date()
                            .not_null(),
                    )
                    .primary_key(
                        Index::create()
                            .col(mission_completion::Column::UserId)
                            .col(mission_completion::Column::MissionType)
                            .col(mission_completion::Column::CompletedDate),
                    )
                    .foreign_key(
                        ForeignKey::create()
                            .from(
                                mission_completion::Entity,
                                mission_completion::Column::UserId,
                            )
                            .to(user::Entity, user::Column::Id)
                            .on_delete(ForeignKeyAction::Cascade),
                    )
                    .to_owned(),
            )
            .await?;

        // Referrals
        manager
            .create_table(
                Table::create()
                    .table(referral::Entity)
                    .if_not_exists()
                    .col(
                        ColumnDef::new(referral::Column::ReferrerId)
                            .uuid()
                            .not_null(),
                    )
                    .col(
                        ColumnDef::new(referral::Column::ReferredId)
                            .uuid()
                            .not_null(),
                    )
                    .col(ColumnDef::new(referral::Column::CompletedAt).date_time())
                    .col(
                        ColumnDef::new(referral::Column::BonusCredited)
                            .boolean()
                            .not_null()
                            .default(false),
                    )
                    .primary_key(
                        Index::create()
                            .col(referral::Column::ReferrerId)
                            .col(referral::Column::ReferredId),
                    )
                    .foreign_key(
                        ForeignKey::create()
                            .from(referral::Entity, referral::Column::ReferrerId)
                            .to(user::Entity, user::Column::Id)
                            .on_delete(ForeignKeyAction::Cascade),
                    )
                    .foreign_key(
                        ForeignKey::create()
                            .from(referral::Entity, referral::Column::ReferredId)
                            .to(user::Entity, user::Column::Id)
                            .on_delete(ForeignKeyAction::Cascade),
                    )
                    .to_owned(),
            )
            .await?;

        // Materialised view as table
        manager
            .create_table(
                Table::create()
                    .table(leaderboard_global_mv::Entity)
                    .if_not_exists()
                    .col(
                        ColumnDef::new(leaderboard_global_mv::Column::UserId)
                            .uuid()
                            .not_null()
                            .primary_key(),
                    )
                    .col(
                        ColumnDef::new(leaderboard_global_mv::Column::DisplayName)
                            .string()
                            .not_null(),
                    )
                    .col(
                        ColumnDef::new(leaderboard_global_mv::Column::TotalChipsWon)
                            .big_integer()
                            .not_null(),
                    )
                    .col(
                        ColumnDef::new(leaderboard_global_mv::Column::RankPosition)
                            .integer()
                            .not_null(),
                    )
                    .col(
                        ColumnDef::new(leaderboard_global_mv::Column::RefreshedAt)
                            .date_time()
                            .not_null(),
                    )
                    .to_owned(),
            )
            .await?;

        // Indexes
        manager
            .create_index(
                Index::create()
                    .name("idx_hand_history_played_at")
                    .table(hand_history::Entity)
                    .col(hand_history::Column::PlayedAt)
                    .to_owned(),
            )
            .await?;
        manager
            .create_index(
                Index::create()
                    .name("idx_hand_history_table_id")
                    .table(hand_history::Entity)
                    .col(hand_history::Column::TableId)
                    .to_owned(),
            )
            .await?;
        manager
            .create_index(
                Index::create()
                    .name("idx_subscription_events_user_id")
                    .table(subscription_event::Entity)
                    .col(subscription_event::Column::UserId)
                    .to_owned(),
            )
            .await?;
        manager
            .create_index(
                Index::create()
                    .name("idx_player_ranks_user_id")
                    .table(player_rank::Entity)
                    .col(player_rank::Column::UserId)
                    .to_owned(),
            )
            .await?;
        manager
            .create_index(
                Index::create()
                    .name("idx_player_ranks_season_id")
                    .table(player_rank::Entity)
                    .col(player_rank::Column::SeasonId)
                    .to_owned(),
            )
            .await?;
        manager
            .create_index(
                Index::create()
                    .name("idx_club_memberships_user_id")
                    .table(club_memberships::Entity)
                    .col(club_memberships::Column::UserId)
                    .to_owned(),
            )
            .await?;
        manager
            .create_index(
                Index::create()
                    .name("idx_club_memberships_club_id")
                    .table(club_memberships::Entity)
                    .col(club_memberships::Column::ClubId)
                    .to_owned(),
            )
            .await?;
        manager
            .create_index(
                Index::create()
                    .name("idx_users_telegram_id")
                    .table(user::Entity)
                    .col(user::Column::TelegramId)
                    .to_owned(),
            )
            .await?;
        manager
            .create_index(
                Index::create()
                    .name("idx_tables_club_id")
                    .table(table::Entity)
                    .col(table::Column::ClubId)
                    .to_owned(),
            )
            .await?;

        Ok(())
    }

    async fn down(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .drop_table(
                Table::drop()
                    .table(leaderboard_global_mv::Entity)
                    .to_owned(),
            )
            .await?;
        manager
            .drop_table(Table::drop().table(referral::Entity).to_owned())
            .await?;
        manager
            .drop_table(Table::drop().table(mission_completion::Entity).to_owned())
            .await?;
        manager
            .drop_table(Table::drop().table(subscription_event::Entity).to_owned())
            .await?;
        manager
            .drop_table(Table::drop().table(hand_history::Entity).to_owned())
            .await?;
        manager
            .drop_table(Table::drop().table(table::Entity).to_owned())
            .await?;
        manager
            .drop_table(Table::drop().table(club_memberships::Entity).to_owned())
            .await?;
        manager
            .drop_table(Table::drop().table(clubs::Entity).to_owned())
            .await?;
        manager
            .drop_table(Table::drop().table(player_rank::Entity).to_owned())
            .await?;
        manager
            .drop_table(Table::drop().table(season::Entity).to_owned())
            .await?;
        manager
            .drop_table(Table::drop().table(session::Entity).to_owned())
            .await?;
        manager
            .drop_table(Table::drop().table(user::Entity).to_owned())
            .await?;
        Ok(())
    }
}

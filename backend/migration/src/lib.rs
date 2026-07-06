#![allow(clippy::needless_update)]
#![allow(clippy::enum_variant_names)]

mod m20250101_000001_add_participants_to_hand_history;
mod m20250614_create_payment_intents;
mod m20250701_000001_add_telegram_chat_id_to_clubs;
mod m20260101_000008_player_statistics;
mod m20260607_000001_create_all_tables;
mod m20260607_000002_create_clubs_tables;
mod m20260614_145806_add_referrals_and_counters;
mod m20260614_152712_add_registration_order_to_users;
mod m20260614_152713_add_referrer_id_index;
mod m20260614_171633_create_anti_cheat_events;
mod m20260615_add_password_hash_to_users;
mod m20260616_seed_base_tables;
mod m20260617_add_table_name;
mod m20260622_132958_mission_system;
mod m20260624_create_tournament_tables;
mod m20260625_seed_tournaments;
mod m20260626_000001_add_club_pro_expires_at_to_users;
mod m20260627_add_season_pass_columns;
mod m20260628_000001_gdpr_deletion;
mod m20260628_161024_create_user_badges_table;
mod m20260628_add_processed_to_seasons;
mod m20260628_add_scheduled_start_to_tournaments;
mod m20260628_create_user_season_cards;
mod m20260629_000001_add_division_to_club_memberships;


use sea_orm_migration::prelude::*;

pub struct Migrator;

#[async_trait::async_trait]
impl MigratorTrait for Migrator {
    fn migrations() -> Vec<Box<dyn MigrationTrait>> {
        vec![
            // 1. Core tables
            Box::new(m20260607_000001_create_all_tables::Migration),
            Box::new(m20260607_000002_create_clubs_tables::Migration),
            // 2. Add columns to existing tables
            Box::new(m20260627_add_season_pass_columns::Migration),
            // 2. Add columns to existing tables
            Box::new(m20260617_add_table_name::Migration),
            Box::new(m20260615_add_password_hash_to_users::Migration),
            Box::new(m20260628_add_processed_to_seasons::Migration),
            // 3. Additional tables
            Box::new(m20250614_create_payment_intents::Migration),
            Box::new(m20260614_145806_add_referrals_and_counters::Migration),
            Box::new(m20260614_171633_create_anti_cheat_events::Migration),
            Box::new(m20260101_000008_player_statistics::Migration),
            Box::new(m20250101_000001_add_participants_to_hand_history::Migration),
            Box::new(m20260614_152712_add_registration_order_to_users::Migration),
            Box::new(m20260614_152713_add_referrer_id_index::Migration),
            Box::new(m20260622_132958_mission_system::Migration),
            Box::new(m20260628_create_user_season_cards::Migration),
            // 4. Tournament tables
            Box::new(m20260624_create_tournament_tables::Migration),
            // 5. Pro Settings (must be before seeding)
            Box::new(m20260626_000001_add_club_pro_expires_at_to_users::Migration),
            // 6. Seed data

            Box::new(m20260616_seed_base_tables::Migration),
            Box::new(m20260628_add_scheduled_start_to_tournaments::Migration),
            Box::new(m20260625_seed_tournaments::Migration),
            // 6. Additional from HEAD
            Box::new(m20250701_000001_add_telegram_chat_id_to_clubs::Migration),
            // 7. Additional from main
            Box::new(m20260628_000001_gdpr_deletion::Migration),
            Box::new(m20260628_161024_create_user_badges_table::Migration),
            Box::new(m20260629_000001_add_division_to_club_memberships::Migration),
        ]
    }
}

pub mod m20260628_000001_create_puzzle_submissions;

#![allow(clippy::needless_update)]
#![allow(clippy::enum_variant_names)]

mod m20250101_000001_add_participants_to_hand_history;
mod m20250614_create_payment_intents;
mod m20250701_000001_add_telegram_chat_id_to_clubs;
mod m20260101_000008_player_statistics;
mod m20260607_000001_create_all_tables;
mod m20260607_000002_create_clubs_tables;
// mod m20260614_145806_add_referrals_and_counters; // removed – table already exists
mod m20260614_152712_add_registration_order_to_users;
mod m20260614_152713_add_referrer_id_index;
mod m20260614_171633_create_anti_cheat_events;
mod m20260615_add_password_hash_to_users;
mod m20260616_seed_base_tables;
mod m20260709_000001_create_products_table;
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
mod m20260629162121_grandfather_existing_users;
mod m20260629_000001_add_division_to_club_memberships;
mod m20260630_add_email_verified_at;
mod m20260630_add_password_changed_at;
mod m20250702_add_tournament_name;
mod m20260710_000001_add_hand_count_to_referral;
mod m20260614_145806_add_referrals_and_counters;
mod m20260711_000001_create_device_fingerprints;
mod m20260711_add_push_subscription;

use sea_orm_migration::prelude::*;

pub struct Migrator;

#[async_trait::async_trait]
impl MigratorTrait for Migrator {
    fn migrations() -> Vec<Box<dyn MigrationTrait>> {
        vec![
            // 1. Core tables
            Box::new(m20260607_000001_create_all_tables::Migration),
            Box::new(m20260710_000001_add_hand_count_to_referral::Migration),
            Box::new(m20260607_000002_create_clubs_tables::Migration),
            // 2. Add columns to existing tables (MUST BE BEFORE SEEDING)
            Box::new(m20260617_add_table_name::Migration),
            Box::new(m20260615_add_password_hash_to_users::Migration),
            Box::new(m20260626_000001_add_club_pro_expires_at_to_users::Migration),
            Box::new(m20260627_add_season_pass_columns::Migration),
            Box::new(m20260628_000001_gdpr_deletion::Migration), // Adds deleted_at
            Box::new(m20260629_000001_add_division_to_club_memberships::Migration),
            Box::new(m20250701_000001_add_telegram_chat_id_to_clubs::Migration),
            Box::new(m20260628_add_processed_to_seasons::Migration),
            Box::new(m20260630_add_email_verified_at::Migration),
            Box::new(m20260630_add_password_changed_at::Migration),
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
            Box::new(m20260628_161024_create_user_badges_table::Migration),
            // 4. Tournament tables
            Box::new(m20260624_create_tournament_tables::Migration),
            Box::new(m20260628_add_scheduled_start_to_tournaments::Migration),
            // 5. Seed data (LAST)
            Box::new(m20260616_seed_base_tables::Migration),
            Box::new(m20250702_add_tournament_name::Migration),
            Box::new(m20260625_seed_tournaments::Migration),
            // 6. Data migrations (MUST run AFTER all columns exist)
            Box::new(m20260629162121_grandfather_existing_users::Migration),
            // 7. Products table
            Box::new(m20260709_000001_create_products_table::Migration),
            Box::new(m20260711_add_push_subscription::Migration),
            // 8. Device Fingerprints table
            Box::new(m20260711_000001_create_device_fingerprints::Migration),
        ]
    }
}

pub mod m20260628_000001_create_puzzle_submissions;
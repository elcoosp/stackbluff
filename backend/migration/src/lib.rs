mod m20250101_000001_add_participants_to_hand_history;
mod m20250614_create_payment_intents;
mod m20260101_000008_player_statistics;
mod m20260607_000001_create_all_tables;
mod m20260607_000002_create_clubs_tables;
mod m20260614_145806_add_referrals_and_counters;
mod m20260614_152712_add_registration_order_to_users; // ADDED
mod m20260614_152713_add_referrer_id_index;
mod m20260614_171633_create_anti_cheat_events;
mod m20260615_add_password_hash_to_users;
use sea_orm_migration::prelude::*;

mod m20260616_seed_base_tables;
mod m20260617_add_table_name;
pub struct Migrator;

#[async_trait::async_trait]
impl MigratorTrait for Migrator {
    fn migrations() -> Vec<Box<dyn MigrationTrait>> {
        vec![
            Box::new(m20260607_000001_create_all_tables::Migration),
            Box::new(m20260607_000002_create_clubs_tables::Migration),
            Box::new(m20250614_create_payment_intents::Migration),
            Box::new(m20260614_145806_add_referrals_and_counters::Migration),
            Box::new(m20260614_152712_add_registration_order_to_users::Migration),
            Box::new(m20260614_152713_add_referrer_id_index::Migration),
            Box::new(m20260614_171633_create_anti_cheat_events::Migration),
            Box::new(m20260615_add_password_hash_to_users::Migration),
            Box::new(m20260617_add_table_name::Migration),
            Box::new(m20260616_seed_base_tables::Migration),
            Box::new(m20250101_000001_add_participants_to_hand_history::Migration),
            Box::new(m20260101_000008_player_statistics::Migration),
        ]
    }
}

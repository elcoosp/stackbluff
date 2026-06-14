mod m20260614_171633_create_anti_cheat_events;

use sea_orm_migration::prelude::*;

pub struct Migrator;

#[async_trait::async_trait]
impl MigratorTrait for Migrator {
    fn migrations() -> Vec<Box<dyn MigrationTrait>> {
        vec![
            Box::new(m20260614_171633_create_anti_cheat_events::Migration),
        ]
    }
}
pub mod m20250614_create_payment_intents;

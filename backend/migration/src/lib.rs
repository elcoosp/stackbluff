mod m20260614_171633_create_anti_cheat_events;
pub use sea_orm_migration::prelude::*;

mod m20260607_000001_create_all_tables;
mod m20260607_000002_create_clubs_tables;

pub struct Migrator;

#[async_trait::async_trait]
impl MigratorTrait for Migrator {
    fn migrations() -> Vec<Box<dyn MigrationTrait>> {
            Box::new(m20260614_171633_create_anti_cheat_events::Migration),
            Box::new($MODULE_NAME::Migration),
        vec![
            Box::new(m20260607_000001_create_all_tables::Migration),
            Box::new(m20260607_000002_create_clubs_tables::Migration),
        ]
    }
}

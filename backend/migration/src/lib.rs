pub use sea_orm_migration::prelude::*;

mod m20260607_000001_create_all_tables;
mod m20240601_000001_create_clubs_table;

pub struct Migrator;

#[async_trait::async_trait]
impl MigratorTrait for Migrator {
    fn migrations() -> Vec<Box<dyn MigrationTrait>> {
        vec![
            Box::new(m20260607_000001_create_all_tables::Migration),
            Box::new(m20240601_000001_create_clubs_table::Migration),
        ]
    }
}

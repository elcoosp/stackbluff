use crate::error::Result;
use sea_orm::DatabaseConnection;
use std::path::Path;

pub async fn run_generate(_db: &DatabaseConnection, _project_dir: &Path, _deck_id: &str, _takes: u32, _delay: &str) -> Result<()> {
    Ok(())
}

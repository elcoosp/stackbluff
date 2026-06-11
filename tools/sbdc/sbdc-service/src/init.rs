use crate::error::Result;
use sea_orm::DatabaseConnection;
use std::path::Path;

pub async fn run_init(_db: &DatabaseConnection, _project_dir: &Path) -> Result<()> {
    Ok(())
}

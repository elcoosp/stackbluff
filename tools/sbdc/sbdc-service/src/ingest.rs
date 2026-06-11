use crate::error::Result;
use sea_orm::DatabaseConnection;
use std::path::Path;

pub async fn run_ingest_json(_db: &DatabaseConnection, _deck_id: &str, _file_path: &Path) -> Result<()> {
    Ok(())
}

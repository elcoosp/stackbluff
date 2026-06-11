use crate::error::Result;
use sea_orm::DatabaseConnection;
use std::path::Path;

pub async fn run_scaffold(_db: &DatabaseConnection, _project_dir: &Path, _deck_id: &str, _season_id: &str) -> Result<()> {
    Ok(())
}

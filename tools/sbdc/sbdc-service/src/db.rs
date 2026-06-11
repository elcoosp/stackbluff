use crate::error::{Result, SbdcError};
use sea_orm::{ConnectOptions, Database, DatabaseConnection};
use std::path::Path;
use std::time::Duration;

const DEFAULT_DB_DIR: &str = ".sbdc";
const DEFAULT_DB_NAME: &str = "sbdc.db";

pub fn db_url(project_dir: &Path) -> String {
    let db_path = project_dir.join(DEFAULT_DB_DIR).join(DEFAULT_DB_NAME);
    format!("sqlite://{}?mode=rwc", db_path.to_str().unwrap())
}

pub async fn connect(database_url: &str) -> Result<DatabaseConnection> {
    let mut opt = ConnectOptions::new(database_url);
    opt.max_connections(5)
        .min_connections(1)
        .connect_timeout(Duration::from_secs(5))
        .idle_timeout(Duration::from_secs(60));

    let db = Database::connect(opt)
        .await
        .map_err(|e| SbdcError::DbConnection(e.to_string()))?;

    tracing::info!(url = database_url, "database connected");
    Ok(db)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;

    #[test]
    fn db_url_constructs_correctly() {
        let dir = PathBuf::from("/tmp/myproject");
        let url = db_url(&dir);
        assert_eq!(url, "sqlite:///tmp/myproject/.sbdc/sbdc.db?mode=rwc");
    }
}

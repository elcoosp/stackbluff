use crate::error::Result;
use sea_orm::DatabaseConnection;

pub async fn run_build_prompts(_db: &DatabaseConnection, _deck_id: &str) -> Result<()> {
    Ok(())
}

use crate::error::{Result, SbdcError};
use sbdc_entity::{deck, generated_prompt};
use sea_orm::{ColumnTrait, EntityTrait, QueryFilter};
use std::path::Path;
use tracing;

pub async fn run_generate(
    db: &sea_orm::DatabaseConnection,
    _project_dir: &Path,
    deck_id: &str,
    takes: u32,
    _delay: &str,
) -> Result<()> {
    if takes == 0 {
        tracing::info!("takes = 0, skipping generation");
        return Ok(());
    }

    let _deck_model = deck::Entity::find()
        .filter(deck::Column::DeckId.eq(deck_id))
        .one(db)
        .await?
        .ok_or_else(|| SbdcError::DeckNotFound(deck_id.into()))?;

    let prompts = generated_prompt::Entity::find()
        .filter(generated_prompt::Column::DeckId.eq(deck_id))
        .filter(generated_prompt::Column::Status.eq("ready_to_generate"))
        .all(db)
        .await?;

    if prompts.is_empty() {
        tracing::warn!("No prompts ready");
        return Ok(());
    }

    Err(SbdcError::DbOperation(
        "The old generate command using Node bridge is deprecated. Please use `sbdc serve` and the Chrome extension instead.".into(),
    ))
}

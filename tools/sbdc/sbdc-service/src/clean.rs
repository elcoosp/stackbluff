use crate::error::{Result, SbdcError};
use sbdc_entity::{deck, generated_prompt, prompt_take};
use sea_orm::{ActiveModelTrait, ColumnTrait, EntityTrait, QueryFilter, Set};
use std::path::Path;
use tracing;

pub async fn run_clean(
    db: &sea_orm::DatabaseConnection,
    project_dir: &Path,
    deck_id: &str,
) -> Result<()> {
    let deck_model = deck::Entity::find()
        .filter(deck::Column::DeckId.eq(deck_id))
        .one(db)
        .await?
        .ok_or_else(|| SbdcError::DeckNotFound(deck_id.into()))?;

    let prompts = generated_prompt::Entity::find()
        .filter(generated_prompt::Column::DeckId.eq(deck_id))
        .filter(generated_prompt::Column::Status.eq("takes_ready"))
        .all(db)
        .await?;

    let clean_dir = project_dir
        .join("decks")
        .join(&deck_model.season_id)
        .join(deck_id)
        .join("3-clean");
    tokio::fs::create_dir_all(&clean_dir).await?;

    for prompt in &prompts {
        let take = prompt_take::Entity::find()
            .filter(prompt_take::Column::PromptId.eq(prompt.prompt_id))
            .filter(prompt_take::Column::IsSelected.eq(true))
            .one(db)
            .await?;

        let take = match take {
            Some(t) => t,
            None => {
                tracing::warn!(prompt_id = prompt.prompt_id, "No selected take");
                continue;
            }
        };

        if !Path::new(&take.file_path).exists() {
            continue;
        }

        let target_path = clean_dir.join(&prompt.target_file);
        tokio::fs::copy(&take.file_path, &target_path).await?;

        let mut active: generated_prompt::ActiveModel = prompt.clone().into();
        active.status = Set("cleaned".into());
        active.update(db).await?;
    }

    Ok(())
}

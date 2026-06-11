use crate::error::{Result, SbdcError};
use sbdc_entity::{deck, generated_prompt, prompt_take};
use sea_orm::{
    ActiveModelTrait, ColumnTrait, EntityTrait, NotSet, QueryFilter, Set,
};
use serde::{Deserialize, Serialize};
use std::path::Path;
use tokio::io::AsyncWriteExt;
use tokio::process::Command;
use tracing;

#[derive(Serialize)]
struct ManifestEntry {
    prompt_id: i32,
    positive: String,
    negative: String,
    shape: String,
}

#[derive(Deserialize, Debug)]
struct GenerationResult {
    prompt_id: i32,
    file_path: Option<String>,
    success: bool,
}

pub async fn run_generate(
    db: &sea_orm::DatabaseConnection,
    project_dir: &Path,
    deck_id: &str,
    takes: u32,
    _delay: &str,
) -> Result<()> {
    let deck_model = deck::Entity::find()
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

    let takes_dir = project_dir
        .join("decks")
        .join(&deck_model.season_id)
        .join(deck_id)
        .join("0-takes");
    tokio::fs::create_dir_all(&takes_dir).await?;

    for _ in 1..=takes {
        let manifest: Vec<ManifestEntry> = prompts
            .iter()
            .map(|p| ManifestEntry {
                prompt_id: p.prompt_id,
                positive: p.final_positive.clone(),
                negative: p.final_negative.clone(),
                shape: if p.target_variant == "full" {
                    "2:3".into()
                } else {
                    "1:1".into()
                },
            })
            .collect();

        let manifest_json = serde_json::to_string(&manifest)?;

        let mut child = Command::new("node")
            .arg("../sbdc-gen-node/generate.js")
            .arg(&takes_dir)
            .stdin(std::process::Stdio::piped())
            .stdout(std::process::Stdio::piped())
            .stderr(std::process::Stdio::piped())
            .spawn()
            .map_err(SbdcError::Io)?;

        if let Some(mut stdin) = child.stdin.take() {
            stdin
                .write_all(manifest_json.as_bytes())
                .await
                .map_err(SbdcError::Io)?;
            drop(stdin);
        }

        let output = child
            .wait_with_output()
            .await
            .map_err(SbdcError::Io)?;
        if !output.status.success() {
            return Err(SbdcError::DbOperation(format!(
                "Node failed: {}",
                String::from_utf8_lossy(&output.stderr)
            )));
        }

        let results: Vec<GenerationResult> = serde_json::from_slice(&output.stdout)?;
        for result in &results {
            if result.success {
                if let Some(path) = &result.file_path {
                    prompt_take::ActiveModel {
                        take_id: NotSet,
                        prompt_id: Set(result.prompt_id),
                        file_path: Set(path.clone()),
                        is_selected: Set(false),
                    }
                    .insert(db)
                    .await?;
                }
            }
        }
    }

    for p in &prompts {
        let mut active: generated_prompt::ActiveModel = p.clone().into();
        active.status = Set("takes_ready".into());
        active.update(db).await?;
    }

    Ok(())
}

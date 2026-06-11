#![allow(clippy::format_in_format_args)]
use crate::error::{Result, SbdcError};
use sbdc_entity::{
    character, clan, deck, deck_narrative_arc, framing_instruction, generated_prompt,
    junction_type, lore_entry, season, universe,
};
use sea_orm::{ActiveModelTrait, ColumnTrait, EntityTrait, PaginatorTrait, QueryFilter, Set};
use std::collections::HashMap;

fn suit_to_clan_id(suit: &str) -> String {
    match suit {
        "s" => "clan-spades",
        "h" => "clan-hearts",
        "d" => "clan-diamonds",
        "c" => "clan-clubs",
        _ => "clan-spades",
    }
    .to_string()
}

fn parse_card(target_card: &str) -> (String, String) {
    if target_card.len() == 2 {
        (target_card[0..1].to_string(), target_card[1..2].to_string())
    } else if target_card.len() == 3 && target_card.starts_with("10") {
        ("10".to_string(), target_card[2..3].to_string())
    } else {
        ("2".to_string(), "s".to_string())
    }
}

pub async fn run_build_prompts(db: &sea_orm::DatabaseConnection, deck_id: &str) -> Result<()> {
    let (deck_model, season_model) = deck::Entity::find()
        .filter(deck::Column::DeckId.eq(deck_id))
        .find_also_related(season::Entity)
        .one(db)
        .await?
        .ok_or_else(|| SbdcError::DeckNotFound(deck_id.into()))?;
    let season_model =
        season_model.ok_or_else(|| SbdcError::DbOperation("Season not found".into()))?;

    let universe_model = universe::Entity::find()
        .filter(universe::Column::UniverseId.eq(&season_model.universe_id))
        .one(db)
        .await?
        .ok_or_else(|| SbdcError::DbOperation("Universe not found".into()))?;

    let junction = junction_type::Entity::find()
        .filter(junction_type::Column::JunctionId.eq(&deck_model.junction_type))
        .one(db)
        .await?
        .ok_or_else(|| SbdcError::Validation(format!("Junction {} missing", deck_model.junction_type)))?;

    let all_clans = clan::Entity::find().all(db).await?;
    let clan_map: HashMap<String, clan::Model> = all_clans
        .into_iter()
        .map(|c| (c.clan_id.clone(), c))
        .collect();

    let all_chars = character::Entity::find().all(db).await?;
    let char_map: HashMap<String, character::Model> = all_chars
        .into_iter()
        .map(|c| (c.clan_id.clone(), c))
        .collect();

    let lore_entries = lore_entry::Entity::find()
        .filter(lore_entry::Column::ParentId.eq(deck_id))
        .filter(lore_entry::Column::Injectable.eq(true))
        .filter(lore_entry::Column::Status.eq("approved"))
        .all(db)
        .await?;
    let lore_injection: String = lore_entries
        .iter()
        .map(|l| l.content.as_str())
        .collect::<Vec<_>>()
        .join(" ");

    let arcs = deck_narrative_arc::Entity::find()
        .filter(deck_narrative_arc::Column::DeckId.eq(deck_id))
        .all(db)
        .await?;
    let arc_map: HashMap<(String, String), deck_narrative_arc::Model> = arcs
        .into_iter()
        .map(|a| ((a.rank.clone(), a.suit.clone()), a))
        .collect();

    let prompts = generated_prompt::Entity::find()
        .filter(generated_prompt::Column::DeckId.eq(deck_id))
        .filter(generated_prompt::Column::Status.eq("pending"))
        .all(db)
        .await?;

    let prompt_count = prompts.len();
    for prompt in &prompts {
        let (rank, suit) = parse_card(&prompt.target_card);
        let clan_id = suit_to_clan_id(&suit);
        let clan = clan_map
            .get(&clan_id)
            .ok_or_else(|| SbdcError::Validation(format!("Clan {} not found", clan_id)))?;
        let character_opt = char_map.get(&clan_id);
        let is_face = matches!(rank.as_str(), "J" | "Q" | "K" | "A");

        let arc_desc = arc_map
            .get(&(rank.clone(), suit.clone()))
            .map(|a| a.description.as_str())
            .unwrap_or("");

        let positive = if is_face {
            let char_desc = character_opt
                .map(|c| c.bust_prompt_description.as_str())
                .unwrap_or("majestic figure");
            let artifact_desc = character_opt
                .map(|c| c.artifact_default_desc.as_str())
                .unwrap_or("holding artifact");

            format!(
                "{}, {}, {} {}, {}, {}",
                deck_model.art_style,
                clan.silhouette,
                rank,
                char_desc,
                artifact_desc,
                junction.prompt_fragment,
            )
        } else {
            let mut parts = vec![
                format!("{}, {}", deck_model.art_style, clan.silhouette),
            ];

            if !arc_desc.is_empty() {
                parts.push(format!("scene: {}", arc_desc));
            }

            if !lore_injection.is_empty() {
                let lore_short: String = lore_injection.chars().take(120).collect();
                parts.push(lore_short);
            }

            parts.push(junction.prompt_fragment.clone());

            parts.join(", ")
        };

        let negative = universe_model.default_negative.clone();

        let mut active: generated_prompt::ActiveModel = prompt.clone().into();
        active.final_positive = Set(positive);
        active.final_negative = Set(negative);
        active.status = Set("ready_to_generate".into());
        active.update(db).await?;
    }

    tracing::info!(deck_id, "built prompts for {} cards", prompt_count);
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::init::run_init;
    use crate::scaffold::run_scaffold;
    use sbdc_migration::Migrator;
    use sbdc_migration::MigratorTrait;
    use sea_orm::{ConnectionTrait, Database, DatabaseConnection};
    use tempfile::tempdir;

    async fn setup_test_db() -> DatabaseConnection {
        let db = Database::connect("sqlite::memory:").await.unwrap();
        db.execute_unprepared("PRAGMA foreign_keys = ON;")
            .await
            .unwrap();
        Migrator::up(&db, None).await.unwrap();
        db
    }

    #[tokio::test]
    async fn build_prompts_generates_ready_prompts() {
        let db = setup_test_db().await;
        let dir = tempdir().unwrap();
        run_init(&db, dir.path()).await.unwrap();
        run_scaffold(&db, dir.path(), "build-test", "default_season")
            .await
            .unwrap();

        run_build_prompts(&db, "build-test").await.unwrap();

        let prompts = generated_prompt::Entity::find()
            .filter(generated_prompt::Column::DeckId.eq("build-test"))
            .filter(generated_prompt::Column::Status.eq("ready_to_generate"))
            .all(&db)
            .await
            .unwrap();
        assert!(!prompts.is_empty(), "Should have generated prompts");
        let face_prompt = prompts.iter().find(|p| p.target_card == "Ks").unwrap();
        assert!(
            face_prompt.final_positive.contains("stern king"),
            "Face card missing character injection"
        );
    }

    #[tokio::test]
    async fn prompts_are_reasonable_length() {
        let db = setup_test_db().await;
        let dir = tempdir().unwrap();
        run_init(&db, dir.path()).await.unwrap();
        run_scaffold(&db, dir.path(), "len-test", "default_season")
            .await
            .unwrap();

        run_build_prompts(&db, "len-test").await.unwrap();

        let prompts = generated_prompt::Entity::find()
            .filter(generated_prompt::Column::DeckId.eq("len-test"))
            .filter(generated_prompt::Column::Status.eq("ready_to_generate"))
            .all(&db)
            .await
            .unwrap();

        for p in &prompts {
            assert!(
                p.final_positive.len() < 500,
                "Prompt for {} too long: {} chars",
                p.target_card,
                p.final_positive.len()
            );
        }
    }
}

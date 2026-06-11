#![allow(clippy::format_in_format_args)]
use crate::error::{Result, SbdcError};
use sbdc_entity::{
    character, clan, creative_pattern, deck, deck_narrative_arc, framing_instruction,
    generated_prompt, junction_type, lore_entry, season, universe, virality_mechanic,
};
use sea_orm::{ActiveModelTrait, ColumnTrait, EntityTrait, QueryFilter, Set};
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
    // 1. Load Deck + Season
    let (deck_model, season_model) = deck::Entity::find()
        .filter(deck::Column::DeckId.eq(deck_id))
        .find_also_related(season::Entity)
        .one(db)
        .await?
        .ok_or_else(|| SbdcError::DeckNotFound(deck_id.into()))?;
    let season_model =
        season_model.ok_or_else(|| SbdcError::DbOperation("Season not found".into()))?;

    // 2. Universe
    let universe_model = universe::Entity::find()
        .filter(universe::Column::UniverseId.eq(&season_model.universe_id))
        .one(db)
        .await?
        .ok_or_else(|| SbdcError::DbOperation("Universe not found".into()))?;

    // 3. Batch load structural maps
    let junctions = junction_type::Entity::find().all(db).await?;
    let junction_map: HashMap<String, junction_type::Model> = junctions
        .into_iter()
        .map(|j| (j.junction_id.clone(), j))
        .collect();
    let junction = junction_map.get(&deck_model.junction_type).ok_or_else(|| {
        SbdcError::Validation(format!("Junction {} missing", deck_model.junction_type))
    })?;

    let patterns = creative_pattern::Entity::find().all(db).await?;
    let pattern = patterns
        .first()
        .ok_or_else(|| SbdcError::Validation("No creative pattern".into()))?;

    let framings = framing_instruction::Entity::find().all(db).await?;
    let framing = framings
        .first()
        .ok_or_else(|| SbdcError::Validation("No framing instruction".into()))?;

    let viralities = virality_mechanic::Entity::find().all(db).await?;
    let virality = viralities
        .first()
        .ok_or_else(|| SbdcError::Validation("No virality mechanic".into()))?;

    // 4. Clans and Characters maps
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

    // 5. Injectable lore for this deck
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

    // 6. Narrative arcs map
    let arcs = deck_narrative_arc::Entity::find()
        .filter(deck_narrative_arc::Column::DeckId.eq(deck_id))
        .all(db)
        .await?;
    let arc_map: HashMap<(String, String), deck_narrative_arc::Model> = arcs
        .into_iter()
        .map(|a| ((a.rank.clone(), a.suit.clone()), a))
        .collect();

    // 7. Load all pending prompts for this deck
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
                "{} {} {} {} {} {} {} {} {} {} {} {} {}",
                deck_model.art_style,
                deck_model.theme,
                season_model.global_event,
                format!("{} character, {}", rank, char_desc),
                artifact_desc,
                junction.prompt_fragment,
                clan.silhouette,
                format!(
                    "colors: dark={}, accent={}",
                    clan.primary_dark, clan.primary_accent
                ),
                universe_model.background_invariant,
                universe_model.lighting_invariant,
                pattern.description,
                framing.description,
                virality.description
            )
        } else {
            format!(
                "{} {} {} background environment, scene: {} {} {} {} {} {}",
                deck_model.art_style,
                deck_model.theme,
                season_model.global_event,
                arc_desc,
                lore_injection,
                junction.prompt_fragment,
                clan.silhouette,
                universe_model.background_invariant,
                universe_model.lighting_invariant
            )
        };

        let negative = format!("{}, {}", universe_model.default_negative, clan.pip_texture);

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
}

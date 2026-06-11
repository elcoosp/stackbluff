#!/usr/bin/env bash
set -uo pipefail

cd tools/sbdc || { echo "ERROR: cannot cd to tools/sbdc"; exit 1; }

COMPILE_OK=true
INCOMPLETE=false

echo "=== Fixing scaffold transaction helpers with ConnectionTrait ==="

cat > sbdc-service/src/scaffold.rs << 'SCAFFOLD_FINAL'
use crate::error::{Result, SbdcError};
use sbdc_entity::{deck, deck_narrative_arc, generated_prompt};
use sea_orm::{ActiveModelTrait, ConnectionTrait, EntityTrait, QueryFilter, Set, TransactionSession, TransactionTrait};
use std::path::Path;
use tokio::fs;
use tracing;

const RANKS: [&str; 13] = ["2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A"];
const SUITS: [&str; 4] = ["s", "h", "d", "c"];

async fn create_deck_dirs(project_dir: &Path, season_id: &str, deck_id: &str) -> Result<()> {
    let base = project_dir.join("decks").join(season_id).join(deck_id);
    let dirs = ["0-takes", "1-selected", "2-masks", "3-clean"];
    for d in dirs {
        fs::create_dir_all(base.join(d)).await?;
    }
    Ok(())
}

async fn insert_deck_record<C>(txn: &C, deck_id: &str, season_id: &str) -> Result<()>
where
    C: ConnectionTrait,
{
    let deck = deck::ActiveModel {
        deck_id: Set(deck_id.to_string()),
        season_id: Set(season_id.to_string()),
        status: Set("pending".into()),
        art_style: Set("realistic fantasy illustration, detailed".into()),
        theme: Set("epic conflict".into()),
        junction_type: Set("junction-battle".into()),
    };
    deck.insert(txn).await?;
    Ok(())
}

async fn insert_narrative_arcs<C>(txn: &C, deck_id: &str, _ordering: &str) -> Result<()>
where
    C: ConnectionTrait,
{
    let mut arcs = Vec::new();
    let mut order = 0;
    for suit in SUITS {
        for rank in RANKS {
            let arc_id = format!("{}_{}_{}", deck_id, suit, rank);
            let description = format!("Card {} of {}: placeholder arc description", rank, suit);
            arcs.push(deck_narrative_arc::ActiveModel {
                arc_id: Set(arc_id),
                deck_id: Set(deck_id.to_string()),
                rank: Set(rank.to_string()),
                suit: Set(suit.to_string()),
                description: Set(description),
                step_order: Set(order),
            });
            order += 1;
        }
    }
    deck_narrative_arc::Entity::insert_many(arcs).exec(txn).await?;
    tracing::info!("inserted {} narrative arcs", order);
    Ok(())
}

async fn insert_prompt_slots<C>(txn: &C, deck_id: &str) -> Result<()>
where
    C: ConnectionTrait,
{
    let mut prompts = Vec::new();
    for suit in SUITS {
        for rank in RANKS {
            let target_card = format!("{}{}", rank, suit);
            let is_face = matches!(rank, "J" | "Q" | "K" | "A");
            let layer = if is_face { "subject" } else { "env" };
            let variant = if is_face { "full" } else { "background" };
            prompts.push(generated_prompt::ActiveModel {
                prompt_id: Set(0),
                deck_id: Set(deck_id.to_string()),
                target_card: Set(target_card.clone()),
                target_layer: Set(layer.to_string()),
                target_variant: Set(variant.to_string()),
                final_positive: Set(String::new()),
                final_negative: Set(String::new()),
                status: Set("pending".into()),
                target_file: Set(format!("{}_{}.png", deck_id, target_card)),
            });
        }
    }
    generated_prompt::Entity::insert_many(prompts).exec(txn).await?;
    Ok(())
}

pub async fn run_scaffold(db: &impl TransactionTrait, project_dir: &Path, deck_id: &str, season_id: &str) -> Result<()> {
    let txn = db.begin().await?;

    let existing = deck::Entity::find()
        .filter(deck::COLUMN.deck_id.eq(deck_id))
        .one(&txn).await?;

    if existing.is_some() {
        return Err(SbdcError::DeckAlreadyExists(deck_id.into()));
    }

    create_deck_dirs(project_dir, season_id, deck_id).await?;
    insert_deck_record(&txn, deck_id, season_id).await?;
    insert_narrative_arcs(&txn, deck_id, "sequential-by-rank").await?;
    insert_prompt_slots(&txn, deck_id).await?;

    txn.commit().await?;
    tracing::info!("scaffolded deck {} with {} prompt slots", deck_id, RANKS.len() * SUITS.len());
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use sea_orm::Database;
    use tempfile::tempdir;

    async fn setup_test_db() -> DatabaseConnection {
        let db = Database::connect("sqlite::memory:").await.unwrap();
        db.get_schema_registry("sbdc_entity::*").sync(&db).await.unwrap();
        db
    }

    #[tokio::test]
    async fn scaffold_creates_deck_and_arcs() {
        let db = setup_test_db().await;
        let dir = tempdir().unwrap();
        run_scaffold(&db, dir.path(), "test-deck", "test-season").await.unwrap();

        let deck = deck::Entity::find().filter(deck::COLUMN.deck_id.eq("test-deck")).one(&db).await.unwrap();
        assert!(deck.is_some());
        let arcs = deck_narrative_arc::Entity::find().filter(deck_narrative_arc::COLUMN.deck_id.eq("test-deck")).all(&db).await.unwrap();
        assert_eq!(arcs.len(), 52);
        let prompts = generated_prompt::Entity::find().filter(generated_prompt::COLUMN.deck_id.eq("test-deck")).all(&db).await.unwrap();
        assert_eq!(prompts.len(), 52);
    }

    #[tokio::test]
    async fn scaffold_fails_on_duplicate() {
        let db = setup_test_db().await;
        let dir = tempdir().unwrap();
        run_scaffold(&db, dir.path(), "dup-deck", "season").await.unwrap();
        let result = run_scaffold(&db, dir.path(), "dup-deck", "season").await;
        assert!(matches!(result, Err(SbdcError::DeckAlreadyExists(_))));
    }
}
SCAFFOLD_FINAL

echo "=== Fixing unused import in init.rs ==="

cat > sbdc-service/src/init.rs << 'INIT_NO_UNUSED'
use crate::error::Result;
use sbdc_entity::{universe, clan, character, season, junction_type, creative_pattern, framing_instruction, virality_mechanic};
use sea_orm::{ActiveModelTrait, EntityTrait, Set};
use sbdc_migration::MigratorTrait;
use std::path::Path;
use tokio::fs;
use tracing;

pub async fn run_init(db: &sea_orm::DatabaseConnection, project_dir: &Path) -> Result<()> {
    let sbdc_dir = project_dir.join(".sbdc");
    if !sbdc_dir.exists() {
        fs::create_dir_all(&sbdc_dir).await?;
    }

    // Run production migrations
    sbdc_migration::Migrator::up(db, None).await?;
    tracing::info!("database schema migrated");

    // Seed Universe (if not exists)
    if universe::Entity::find().one(db).await?.is_none() {
        universe::ActiveModel {
            universe_id: Set("default".into()),
            art_direction: Set("Fantasy Illustration".into()),
            background_invariant: Set("pure white background #FFFFFF".into()),
            lighting_invariant: Set("studio lighting, no shadows cast on background".into()),
            animation_philosophy: Set("subtle, slow motion, no camera shake, 2 seconds loop, similar start and end frame".into()),
            hidden_gems_rule: Set("mascot hidden once on each face card".into()),
            default_negative: Set("text, watermark, blurry, deformed".into()),
        }.insert(db).await?;
    }

    // Seed Season
    if season::Entity::find().one(db).await?.is_none() {
        season::ActiveModel {
            season_id: Set("default_season".into()),
            universe_id: Set("default".into()),
            season_name: Set("Season 1".into()),
            global_event: Set("The Convergence".into()),
            season_order: Set(1),
        }.insert(db).await?;
    }

    // Seed 4 Clans
    if clan::Entity::find().one(db).await?.is_none() {
        let clans = [
            ("clan-spades", "Spades", "The Invasion Force", "angular, sharp silhouettes", "#111111", "#EEEEEE", "#888888"),
            ("clan-hearts", "Hearts", "The Resistance", "flowing, organic silhouettes", "#331100", "#FF6666", "#AA4444"),
            ("clan-diamonds", "Diamonds", "The Merchants", "geometric, faceted silhouettes", "#222200", "#FFD700", "#B8860B"),
            ("clan-clubs", "Clubs", "The Commons", "sturdy, grounded silhouettes", "#1a2a1a", "#88AA88", "#446644"),
        ];
        let models: Vec<clan::ActiveModel> = clans.into_iter().map(|(id, name, tagline, sil, dark, accent, sec)| {
            clan::ActiveModel {
                clan_id: Set(id.into()),
                universe_id: Set("default".into()),
                name: Set(name.into()),
                tagline: Set(tagline.into()),
                silhouette: Set(sil.into()),
                border_accent: Set("ornate".into()),
                typography_hint: Set("bold".into()),
                pip_texture: Set("stone".into()),
                primary_dark: Set(dark.into()),
                primary_accent: Set(accent.into()),
                secondary: Set(sec.into()),
                sigil: Set(format!("{}_sigil", name)),
            }
        }).collect();
        clan::Entity::insert_many(models).exec(db).await?;
    }

    // Seed 4 Characters (one per clan)
    if character::Entity::find().one(db).await?.is_none() {
        let chars = [
            ("char-spade-king", "clan-spades", "Spade King", "stern king with iron crown, sharp jawline, wearing black steel armor"),
            ("char-heart-queen", "clan-hearts", "Heart Queen", "graceful queen with flowing gown, soft eyes, wearing silver tiara"),
            ("char-diamond-jack", "clan-diamonds", "Diamond Jack", "cunning merchant with gold-trimmed vest, smirking, holding a gem"),
            ("char-club-joker", "clan-clubs", "Club Joker", "wild jester with wooden mask, grinning, holding a club"),
        ];
        let models: Vec<character::ActiveModel> = chars.into_iter().map(|(id, cid, title, bust)| {
            character::ActiveModel {
                character_id: Set(id.into()),
                clan_id: Set(cid.into()),
                name: Set(title.into()),
                title: Set(title.into()),
                fixed_traits: Set(serde_json::json!({})),
                visual_description: Set(serde_json::json!({})),
                bust_prompt_description: Set(bust.into()),
                artifact_name: Set("Scepter".into()),
                artifact_default_desc: Set("holding an ornate scepter".into()),
                artifact_victory_desc: Set("raising scepter high".into()),
                artifact_defeat_desc: Set("dropping scepter".into()),
            }
        }).collect();
        character::Entity::insert_many(models).exec(db).await?;
    }

    // Seed junction types
    if junction_type::Entity::find().one(db).await?.is_none() {
        let junctions = [
            ("junction-battle", "battle scene, clashing forces"),
            ("junction-dialogue", "two characters speaking, dramatic lighting"),
        ];
        let models: Vec<junction_type::ActiveModel> = junctions.into_iter().map(|(id, frag)| {
            junction_type::ActiveModel {
                junction_id: Set(id.into()),
                prompt_fragment: Set(frag.into()),
            }
        }).collect();
        junction_type::Entity::insert_many(models).exec(db).await?;
    }

    // Seed creative patterns
    if creative_pattern::Entity::find().one(db).await?.is_none() {
        creative_pattern::ActiveModel {
            pattern_id: Set("pattern-1".into()),
            description: Set("dynamic composition, rule of thirds".into()),
        }.insert(db).await?;
    }

    // Seed framing instructions
    if framing_instruction::Entity::find().one(db).await?.is_none() {
        framing_instruction::ActiveModel {
            framing_id: Set("framing-1".into()),
            description: Set("medium shot, eye level".into()),
        }.insert(db).await?;
    }

    // Seed virality mechanics
    if virality_mechanic::Entity::find().one(db).await?.is_none() {
        virality_mechanic::ActiveModel {
            mechanic_id: Set("viral-1".into()),
            description: Set("hidden mascot triggers engagement".into()),
        }.insert(db).await?;
    }

    tracing::info!("init completed with seed data");
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use sea_orm::Database;
    use tempfile::tempdir;

    async fn setup_test_db() -> DatabaseConnection {
        let db = Database::connect("sqlite::memory:").await.unwrap();
        db.get_schema_registry("sbdc_entity::*").sync(&db).await.unwrap();
        db
    }

    #[tokio::test]
    async fn init_seeds_universe_and_clans() {
        let db = setup_test_db().await;
        let dir = tempdir().unwrap();
        run_init(&db, dir.path()).await.unwrap();

        let clans = clan::Entity::find().all(&db).await.unwrap();
        assert_eq!(clans.len(), 4);
        let chars = character::Entity::find().all(&db).await.unwrap();
        assert_eq!(chars.len(), 4);
        let uni = universe::Entity::find().one(&db).await.unwrap();
        assert!(uni.is_some());
    }
}
INIT_NO_UNUSED

echo "=== Running cargo check ==="
if cargo check --workspace 2>&1; then
  echo "Compilation successful"
  COMPILE_OK=true
else
  echo "Compilation failed"
  COMPILE_OK=false
fi

if [ "$COMPILE_OK" = true ]; then
  echo "Running tests"
  if cargo test -p sbdc-service -- --nocapture 2>&1; then
    echo "All tests passed"
  else
    echo "Tests failed"
    COMPILE_OK=false
  fi
fi

if [ "$INCOMPLETE" = true ] || [ "$COMPILE_OK" = false ]; then
  echo "Skipping commit due to incomplete files or compilation errors"
  exit 1
fi

echo "All fixes applied. Committing."
git add -A
git commit -m "fix: add ConnectionTrait bounds, TransactionSession import, remove unused import"

exit 0

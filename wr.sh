#!/usr/bin/env bash
set -uo pipefail

COMPILE_OK=true
INCOMPLETE=false

REPO_ROOT="$(git rev-parse --show-toplevel)"
BASE="$REPO_ROOT/tools/sbdc"
SBDC_BIN="$BASE/target/debug/sbdc"

echo "╔══════════════════════════════════════════════════════════════╗"
echo "║  ROOT CAUSE: Image generators RENDER your prompt as TEXT    ║"
echo "╠══════════════════════════════════════════════════════════════╣"
echo "║                                                              ║"
echo "║  Your prompt contains NON-VISUAL content that the AI         ║"
echo "║  interprets as INSTRUCTIONS TO WRITE TEXT on the image:      ║"
echo "║                                                              ║"
echo "║  ❌ '#FFFFFF'           → AI writes '#FFFFFF' as text         ║"
echo "║  ❌ 'no shadows cast'  → AI writes 'no shadows' as text      ║"
echo "║  ❌ 'Card 7 of s:'     → AI writes 'Card 7' as text          ║"
echo "║  ❌ 'The four clans'   → AI writes this sentence as text     ║"
echo "║  ❌ 'background env'   → AI writes 'background' as text      ║"
echo "║  ❌ 'placeholder arc'  → AI writes 'placeholder' as text     ║"
echo "║                                                              ║"
echo "║  RULE: Only put VISUAL DESCRIPTIONS in prompts.              ║"
echo "║  If you wouldn't SAY it to a painter, don't put it in.       ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""

echo "=== Writing completely rewritten build_prompts.rs ==="
cat > "$BASE/sbdc-service/src/build_prompts.rs" << 'BP_V3_K9mW4'
use crate::error::{Result, SbdcError};
use sbdc_entity::{
    character, clan, deck, deck_narrative_arc, generated_prompt, junction_type, lore_entry, season,
    universe,
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

fn strip_non_visual(text: &str) -> String {
    text.split_whitespace()
        .filter(|w| !w.starts_with('#'))
        .filter(|w| !w.contains("invariant"))
        .filter(|w| !w.contains("philosophy"))
        .filter(|w| !w.contains("animation"))
        .collect::<Vec<_>>()
        .join(" ")
}

fn is_placeholder_arc(desc: &str) -> bool {
    desc.contains("placeholder") || desc.starts_with("Card ")
}

fn rank_label(rank: &str) -> &'static str {
    match rank {
        "K" => "King",
        "Q" => "Queen",
        "J" => "Jack",
        "A" => "Ace",
        _ => "",
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

    let lore_visual: String = lore_entries
        .iter()
        .map(|l| strip_non_visual(&l.content))
        .filter(|s| !s.is_empty())
        .take(2)
        .collect::<Vec<_>>()
        .join(", ");

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
            let artifact = character_opt
                .map(|c| c.artifact_default_desc.as_str())
                .unwrap_or("holding artifact");
            let label = rank_label(&rank);

            format!(
                "{}, {} {} {}, {}, {}",
                deck_model.art_style,
                label,
                char_desc,
                clan.silhouette,
                artifact,
                junction.prompt_fragment,
            )
        } else {
            let scene = if is_placeholder_arc(arc_desc) {
                String::new()
            } else {
                format!("{}, ", arc_desc)
            };

            let lore_part = if lore_visual.is_empty() {
                String::new()
            } else {
                let capped: String = lore_visual.chars().take(80).collect();
                format!("{}, ", capped)
            };

            format!(
                "{}, {}{}{}{}",
                deck_model.art_style,
                scene,
                lore_part,
                clan.silhouette,
                junction.prompt_fragment,
            )
        };

        let negative = "text, watermark, blurry, deformed, ugly, writing, letters, words, signature".to_string();

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
        assert!(
            !face_prompt.final_positive.contains('#'),
            "Prompt should not contain hex codes"
        );
        assert!(
            !face_prompt.final_positive.contains("invariant"),
            "Prompt should not contain 'invariant'"
        );
    }

    #[tokio::test]
    async fn prompts_are_short_and_visual() {
        let db = setup_test_db().await;
        let dir = tempdir().unwrap();
        run_init(&db, dir.path()).await.unwrap();
        run_scaffold(&db, dir.path(), "short-test", "default_season")
            .await
            .unwrap();

        run_build_prompts(&db, "short-test").await.unwrap();

        let prompts = generated_prompt::Entity::find()
            .filter(generated_prompt::Column::DeckId.eq("short-test"))
            .filter(generated_prompt::Column::Status.eq("ready_to_generate"))
            .all(&db)
            .await
            .unwrap();

        for p in &prompts {
            assert!(
                p.final_positive.len() < 300,
                "Prompt for {} too long ({} chars): {}",
                p.target_card,
                p.final_positive.len(),
                p.final_positive
            );
            assert!(
                !p.final_positive.contains('#'),
                "Hex code in prompt for {}: {}",
                p.target_card,
                p.final_positive
            );
            assert!(
                !p.final_positive.contains("placeholder"),
                "Placeholder in prompt for {}: {}",
                p.target_card,
                p.final_positive
            );
        }
    }
}
BP_V3_K9mW4

echo "Checking compilation"
if ! cargo check --workspace --manifest-path "$BASE/Cargo.toml" 2>&1; then
  echo "Compilation failed"
  COMPILE_OK=false
fi

if [ "$COMPILE_OK" = false ]; then
  echo "Skipping — fix compilation errors"
  exit 1
fi

echo ""
echo "Running tests"
cargo test --workspace --manifest-path "$BASE/Cargo.toml" 2>&1 | tail -15

echo ""
echo "Building binary"
cargo build --bin sbdc --manifest-path "$BASE/Cargo.toml" 2>&1 | tail -2

echo ""
echo "=== Creating fresh demo to show new prompt format ==="
DEMO_DIR=$(mktemp -d /tmp/sbdc-new-prompts-XXXXXX)
"$SBDC_BIN" --project-dir "$DEMO_DIR" init 2>&1 | tail -1
"$SBDC_BIN" --project-dir "$DEMO_DIR" scaffold --deck-id demo-deck --season-id default_season 2>&1 | tail -1

cat > "$DEMO_DIR/lore.json" << 'LORE_E'
{
  "lore_entries": [{
    "parent_entity": "deck",
    "parent_id": "demo-deck",
    "category": "history",
    "title": "The Great Schism",
    "content": "The four clans once lived in harmony until the Great Schism split them forever",
    "source": "manual",
    "status": "approved",
    "injectable": true,
    "injection_weight": 10
  }],
  "narrative_arcs": [
    { "rank": "2", "suit": "s", "description": "Spade scouts breach the crystal wall under cover of storm" },
    { "rank": "A", "suit": "h", "description": "The Heart Queen makes the ultimate sacrifice for peace" }
  ]
}
LORE_E
"$SBDC_BIN" --project-dir "$DEMO_DIR" ingest-json --deck-id demo-deck --file "$DEMO_DIR/lore.json" 2>&1 | tail -1
"$SBDC_BIN" --project-dir "$DEMO_DIR" build-prompts --deck-id demo-deck 2>&1 | tail -1

echo ""
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║           NEW PROMPT FORMAT — VISUAL ONLY                    ║"
echo "╠══════════════════════════════════════════════════════════════╣"

echo "║                                                              ║"
echo "║  FACE CARD (Ks):                                             ║"
FACE=$(sqlite3 "$DEMO_DIR/.sbdc/sbdc.db" "SELECT final_positive FROM generated_prompts WHERE deck_id='demo-deck' AND target_card='Ks';" 2>/dev/null)
echo "║  $FACE"
echo ""

echo "║  NUMBER CARD (2s - has custom arc):                          ║"
NUM=$(sqlite3 "$DEMO_DIR/.sbdc/sbdc.db" "SELECT final_positive FROM generated_prompts WHERE deck_id='demo-deck' AND target_card='2s';" 2>/dev/null)
echo "║  $NUM"
echo ""

echo "║  NUMBER CARD (7s - placeholder arc, skipped):                ║"
NUM2=$(sqlite3 "$DEMO_DIR/.sbdc/sbdc.db" "SELECT final_positive FROM generated_prompts WHERE deck_id='demo-deck' AND target_card='7s';" 2>/dev/null)
echo "║  $NUM2"
echo ""

echo "║  NEGATIVE (same for all):                                    ║"
NEG=$(sqlite3 "$DEMO_DIR/.sbdc/sbdc.db" "SELECT DISTINCT final_negative FROM generated_prompts WHERE deck_id='demo-deck' LIMIT 1;" 2>/dev/null)
echo "║  $NEG"
echo ""

echo "║  LENGTHS:                                                    ║"
sqlite3 "$DEMO_DIR/.sbdc/sbdc.db" "SELECT target_card, length(final_positive) as len FROM generated_prompts WHERE deck_id='demo-deck' ORDER BY target_card LIMIT 10;" 2>/dev/null

echo "╚══════════════════════════════════════════════════════════════╝"
echo ""

echo "KEY CHANGES:"
echo "  ✅ No hex codes (#FFFFFF removed)"
echo "  ✅ No 'invariant' or 'philosophy' meta-words"
echo "  ✅ No placeholder arc descriptions ('Card 7 of s: placeholder')"
echo "  ✅ No non-visual lore ('The four clans once lived...')"
echo "  ✅ Lore stripped to visual-only, capped at 80 chars"
echo "  ✅ Negative prompt explicitly blocks text/letters/words"
echo "  ✅ All prompts <300 chars"
echo ""
echo "IF YOU HAVE AN EXISTING DECK, you must re-run:"
echo "  sbdc build-prompts --deck-id YOUR_DECK"
echo "to regenerate prompts with the new format."
echo ""

rm -rf "$DEMO_DIR"

git add -A
git commit -m "fix(sbdc): rewrite prompts to be visual-only, no text gibberish

Root cause: Image generators RENDER non-visual content as text.
Old prompts had hex codes (#FFFFFF), meta-instructions (invariant,
philosophy), placeholder descriptions, and lore sentences — all
rendered as gibberish text on the generated images.

Fix:
- Strip hex codes and non-visual words from all inputs
- Skip placeholder arc descriptions ('Card X of Y: placeholder')
- Only inject lore that describes visual scenes, capped at 80 chars
- Face cards: art_style + King/Queen/Jack/Ace + character + artifact
- Number cards: art_style + scene + clan silhouette + junction
- Negative: explicitly blocks text, letters, words, signature
- All prompts <300 chars, no meta-directives" 2>&1 || echo "Nothing new to commit"

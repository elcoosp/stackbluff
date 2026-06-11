#!/usr/bin/env bash
set -uo pipefail

cd tools/sbdc || { echo "ERROR: cannot cd to tools/sbdc"; exit 1; }

COMPILE_OK=true
INCOMPLETE=false

echo "Fixing SeaORM version to 2.0.0-rc.40 in workspace Cargo.toml"
OLD_TMP=$(mktemp)
NEW_TMP=$(mktemp)
cat > "$OLD_TMP" << 'VERSION_OLD'
sea-orm = { version = "2.0", features = [
VERSION_OLD
cat > "$NEW_TMP" << 'VERSION_NEW'
sea-orm = { version = "2.0.0-rc.40", features = [
VERSION_NEW
if python3 - "$OLD_TMP" "$NEW_TMP" Cargo.toml << 'PYEOF'
import sys
with open(sys.argv[1], 'r') as f: old = f.read()
with open(sys.argv[2], 'r') as f: new = f.read()
with open(sys.argv[3], 'r') as f: content = f.read()
content = content.replace(old, new)
with open(sys.argv[3], 'w') as f: f.write(content)
PYEOF
then
  echo "Version updated in Cargo.toml"
  rm "$OLD_TMP" "$NEW_TMP"
else
  echo "ERROR: version patch failed"
  rm -f "$OLD_TMP" "$NEW_TMP"
fi

echo "Fixing sea-orm-migration version as well"
OLD_TMP2=$(mktemp)
NEW_TMP2=$(mktemp)
cat > "$OLD_TMP2" << 'MIG_OLD'
sea-orm-migration = { version = "2.0", features = ["sqlx-sqlite", "runtime-tokio-rustls"] }
MIG_OLD
cat > "$NEW_TMP2" << 'MIG_NEW'
sea-orm-migration = { version = "2.0.0-rc.40", features = ["sqlx-sqlite", "runtime-tokio-rustls"] }
MIG_NEW
if python3 - "$OLD_TMP2" "$NEW_TMP2" Cargo.toml << 'PYEOF2'
import sys
with open(sys.argv[1], 'r') as f: old = f.read()
with open(sys.argv[2], 'r') as f: new = f.read()
with open(sys.argv[3], 'r') as f: content = f.read()
content = content.replace(old, new)
with open(sys.argv[3], 'w') as f: f.write(content)
PYEOF2
then
  echo "Migration version updated"
  rm "$OLD_TMP2" "$NEW_TMP2"
else
  echo "ERROR: migration version patch failed"
  rm -f "$OLD_TMP2" "$NEW_TMP2"
fi

echo "Rewriting universe.rs with SeaORM 2.0 patterns (relation fields, no separate Relation enum)"
cat > sbdc-entity/src/universe.rs << 'UNIVERSE_NEW'
use sea_orm::entity::prelude::*;

#[sea_orm::model]
#[derive(Clone, Debug, PartialEq, Eq, DeriveEntityModel)]
#[sea_orm(table_name = "universe")]
pub struct Model {
    #[sea_orm(primary_key, auto_increment = false)]
    pub universe_id: String,
    #[sea_orm(column_type = "Text")]
    pub art_direction: String,
    #[sea_orm(column_type = "Text")]
    pub background_invariant: String,
    #[sea_orm(column_type = "Text")]
    pub lighting_invariant: String,
    #[sea_orm(column_type = "Text")]
    pub animation_philosophy: String,
    #[sea_orm(column_type = "Text")]
    pub hidden_gems_rule: String,
    #[sea_orm(column_type = "Text")]
    pub default_negative: String,
    #[sea_orm(has_many)]
    pub clans: HasMany<super::clan::Entity>,
    #[sea_orm(has_many)]
    pub seasons: HasMany<super::season::Entity>,
}

impl ActiveModelBehavior for ActiveModel {}
UNIVERSE_NEW

echo "Rewriting clan.rs"
cat > sbdc-entity/src/clan.rs << 'CLAN_NEW'
use sea_orm::entity::prelude::*;

#[sea_orm::model]
#[derive(Clone, Debug, PartialEq, Eq, DeriveEntityModel)]
#[sea_orm(table_name = "clans")]
pub struct Model {
    #[sea_orm(primary_key, auto_increment = false)]
    pub clan_id: String,
    pub universe_id: String,
    pub name: String,
    pub tagline: String,
    #[sea_orm(column_type = "Text")]
    pub silhouette: String,
    #[sea_orm(column_type = "Text")]
    pub border_accent: String,
    #[sea_orm(column_type = "Text")]
    pub typography_hint: String,
    #[sea_orm(column_type = "Text")]
    pub pip_texture: String,
    pub primary_dark: String,
    pub primary_accent: String,
    pub secondary: String,
    pub sigil: String,
    #[sea_orm(belongs_to, from = "universe_id", to = "universe_id")]
    pub universe: HasOne<super::universe::Entity>,
    #[sea_orm(has_many)]
    pub characters: HasMany<super::character::Entity>,
}

impl ActiveModelBehavior for ActiveModel {}
CLAN_NEW

echo "Rewriting character.rs"
cat > sbdc-entity/src/character.rs << 'CHARACTER_NEW'
use sea_orm::entity::prelude::*;

#[sea_orm::model]
#[derive(Clone, Debug, PartialEq, Eq, DeriveEntityModel)]
#[sea_orm(table_name = "characters")]
pub struct Model {
    #[sea_orm(primary_key, auto_increment = false)]
    pub character_id: String,
    pub clan_id: String,
    pub name: String,
    pub title: String,
    pub fixed_traits: Json,
    pub visual_description: Json,
    #[sea_orm(column_type = "Text")]
    pub bust_prompt_description: String,
    pub artifact_name: String,
    #[sea_orm(column_type = "Text")]
    pub artifact_default_desc: String,
    #[sea_orm(column_type = "Text")]
    pub artifact_victory_desc: String,
    #[sea_orm(column_type = "Text")]
    pub artifact_defeat_desc: String,
    #[sea_orm(belongs_to, from = "clan_id", to = "clan_id")]
    pub clan: HasOne<super::clan::Entity>,
}

impl ActiveModelBehavior for ActiveModel {}
CHARACTER_NEW

echo "Rewriting season.rs"
cat > sbdc-entity/src/season.rs << 'SEASON_NEW'
use sea_orm::entity::prelude::*;

#[sea_orm::model]
#[derive(Clone, Debug, PartialEq, Eq, DeriveEntityModel)]
#[sea_orm(table_name = "seasons")]
pub struct Model {
    #[sea_orm(primary_key, auto_increment = false)]
    pub season_id: String,
    pub universe_id: String,
    pub season_name: String,
    #[sea_orm(column_type = "Text")]
    pub global_event: String,
    pub season_order: i32,
    #[sea_orm(belongs_to, from = "universe_id", to = "universe_id")]
    pub universe: HasOne<super::universe::Entity>,
    #[sea_orm(has_many)]
    pub decks: HasMany<super::deck::Entity>,
}

impl ActiveModelBehavior for ActiveModel {}
SEASON_NEW

echo "Rewriting deck.rs"
cat > sbdc-entity/src/deck.rs << 'DECK_NEW'
use sea_orm::entity::prelude::*;

#[sea_orm::model]
#[derive(Clone, Debug, PartialEq, Eq, DeriveEntityModel)]
#[sea_orm(table_name = "decks")]
pub struct Model {
    #[sea_orm(primary_key, auto_increment = false)]
    pub deck_id: String,
    pub season_id: String,
    pub status: String,
    #[sea_orm(column_type = "Text")]
    pub art_style: String,
    #[sea_orm(column_type = "Text")]
    pub theme: String,
    pub junction_type: String,
    #[sea_orm(belongs_to, from = "season_id", to = "season_id")]
    pub season: HasOne<super::season::Entity>,
    #[sea_orm(has_many)]
    pub narrative_arcs: HasMany<super::deck_narrative_arc::Entity>,
    #[sea_orm(has_many)]
    pub prompts: HasMany<super::generated_prompt::Entity>,
}

impl ActiveModelBehavior for ActiveModel {}
DECK_NEW

echo "Rewriting deck_narrative_arc.rs"
cat > sbdc-entity/src/deck_narrative_arc.rs << 'ARC_NEW'
use sea_orm::entity::prelude::*;

#[sea_orm::model]
#[derive(Clone, Debug, PartialEq, Eq, DeriveEntityModel)]
#[sea_orm(table_name = "deck_narrative_arcs")]
pub struct Model {
    #[sea_orm(primary_key, auto_increment = false)]
    pub arc_id: String,
    pub deck_id: String,
    pub rank: String,
    pub suit: String,
    #[sea_orm(column_type = "Text")]
    pub description: String,
    pub step_order: i32,
    #[sea_orm(belongs_to, from = "deck_id", to = "deck_id")]
    pub deck: HasOne<super::deck::Entity>,
}

impl ActiveModelBehavior for ActiveModel {}
ARC_NEW

echo "Rewriting generated_prompt.rs"
cat > sbdc-entity/src/generated_prompt.rs << 'GENPROMPT_NEW'
use sea_orm::entity::prelude::*;

#[sea_orm::model]
#[derive(Clone, Debug, PartialEq, Eq, DeriveEntityModel)]
#[sea_orm(table_name = "generated_prompts")]
pub struct Model {
    #[sea_orm(primary_key)]
    pub prompt_id: i32,
    pub deck_id: String,
    pub target_card: String,
    pub target_layer: String,
    pub target_variant: String,
    #[sea_orm(column_type = "Text")]
    pub final_positive: String,
    #[sea_orm(column_type = "Text")]
    pub final_negative: String,
    pub status: String,
    pub target_file: String,
    #[sea_orm(belongs_to, from = "deck_id", to = "deck_id")]
    pub deck: HasOne<super::deck::Entity>,
    #[sea_orm(has_many)]
    pub takes: HasMany<super::prompt_take::Entity>,
}

impl ActiveModelBehavior for ActiveModel {}
GENPROMPT_NEW

echo "Rewriting prompt_take.rs"
cat > sbdc-entity/src/prompt_take.rs << 'TAKE_NEW'
use sea_orm::entity::prelude::*;

#[sea_orm::model]
#[derive(Clone, Debug, PartialEq, Eq, DeriveEntityModel)]
#[sea_orm(table_name = "prompt_takes")]
pub struct Model {
    #[sea_orm(primary_key)]
    pub take_id: i32,
    pub prompt_id: i32,
    #[sea_orm(column_type = "Text")]
    pub file_path: String,
    pub is_selected: bool,
    #[sea_orm(belongs_to, from = "prompt_id", to = "prompt_id")]
    pub prompt: HasOne<super::generated_prompt::Entity>,
}

impl ActiveModelBehavior for ActiveModel {}
TAKE_NEW

echo "Rewriting prompt_comment.rs"
cat > sbdc-entity/src/prompt_comment.rs << 'COMMENT_NEW'
use sea_orm::entity::prelude::*;

#[sea_orm::model]
#[derive(Clone, Debug, PartialEq, Eq, DeriveEntityModel)]
#[sea_orm(table_name = "prompt_comments")]
pub struct Model {
    #[sea_orm(primary_key)]
    pub comment_id: i32,
    pub prompt_id: i32,
    #[sea_orm(column_type = "Text")]
    pub comment: String,
    #[sea_orm(belongs_to, from = "prompt_id", to = "prompt_id")]
    pub prompt: HasOne<super::generated_prompt::Entity>,
}

impl ActiveModelBehavior for ActiveModel {}
COMMENT_NEW

echo "Rewriting composition_schema.rs"
cat > sbdc-entity/src/composition_schema.rs << 'COMPOSITION_NEW'
use sea_orm::entity::prelude::*;

#[sea_orm::model]
#[derive(Clone, Debug, PartialEq, Eq, DeriveEntityModel)]
#[sea_orm(table_name = "composition_schemas")]
pub struct Model {
    #[sea_orm(primary_key, auto_increment = false)]
    pub schema_id: String,
    pub name: String,
    pub layout_json: Json,
}

impl ActiveModelBehavior for ActiveModel {}
COMPOSITION_NEW

echo "Keeping simple entities (lore_entry, character_relationship, junction_type, creative_pattern, framing_instruction, virality_mechanic, prompt_template) as they are (no relations needed)"
# No changes needed for those - they compile fine.

echo "Updating lib.rs to export modules correctly (already fine)"

echo "Running cargo check"
if cargo check --workspace 2>&1; then
  echo "Compilation successful"
  COMPILE_OK=true
else
  echo "Compilation failed – will skip commit"
  COMPILE_OK=false
fi

if [ "$INCOMPLETE" = true ] || [ "$COMPILE_OK" = false ]; then
  echo "Skipping commit due to incomplete files or compilation errors"
  exit 1
fi

echo "All SeaORM 2.0 corrections applied. Committing."
git add -A
git commit -m "fix: upgrade to SeaORM 2.0.0-rc.40 and use proper 2.0 entity patterns (relations on Model)"

exit 0

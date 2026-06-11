#!/usr/bin/env bash
set -uo pipefail

COMPILE_OK=true
INCOMPLETE=false

BASE="tools/sbdc"

echo "=== Discovery: existing file structure ==="
echo "Entity source files:"
ls -1 "$BASE/sbdc-entity/src/" 2>&1 || true
echo ""
echo "Migration source files:"
ls -1 "$BASE/sbdc-migration/src/" 2>&1 || true
echo ""
echo "Service source files:"
ls -1 "$BASE/sbdc-service/src/" 2>&1 || true
echo ""
echo "Service Cargo.toml:"
cat "$BASE/sbdc-service/Cargo.toml" 2>&1 || true
echo ""
echo "Entity Cargo.toml:"
cat "$BASE/sbdc-entity/Cargo.toml" 2>&1 || true
echo ""
echo "Migration Cargo.toml:"
cat "$BASE/sbdc-migration/Cargo.toml" 2>&1 || true
echo ""
echo "Entity lib.rs:"
cat "$BASE/sbdc-entity/src/lib.rs" 2>&1 || true
echo ""
echo "Migration lib.rs:"
cat "$BASE/sbdc-migration/src/lib.rs" 2>&1 || true
echo ""
echo "Service lib.rs:"
cat "$BASE/sbdc-service/src/lib.rs" 2>&1 || true
echo ""
echo "Current server.rs:"
cat "$BASE/sbdc-service/src/server.rs" 2>&1 || true
echo ""
echo "Current generate.rs:"
cat "$BASE/sbdc-service/src/generate.rs" 2>&1 || true
echo ""
echo "Current error.rs:"
cat "$BASE/sbdc-service/src/error.rs" 2>&1 || true
echo ""
echo "Current db.rs:"
cat "$BASE/sbdc-service/src/db.rs" 2>&1 || true
echo ""
echo "Current clean.rs:"
cat "$BASE/sbdc-service/src/clean.rs" 2>&1 || true
echo ""
echo "Current build_prompts.rs:"
cat "$BASE/sbdc-service/src/build_prompts.rs" 2>&1 || true
echo ""
echo "Current scaffold.rs:"
cat "$BASE/sbdc-service/src/scaffold.rs" 2>&1 || true
echo ""
echo "Current init.rs:"
cat "$BASE/sbdc-service/src/init.rs" 2>&1 || true
echo ""
echo "Current ingest.rs:"
cat "$BASE/sbdc-service/src/ingest.rs" 2>&1 || true
echo ""
echo "Extension directory:"
ls -1R "$BASE/sbdc-extension/" 2>&1 || true
echo ""
echo "generated_prompt entity:"
cat "$BASE/sbdc-entity/src/generated_prompt.rs" 2>&1 || true
echo ""
echo "deck entity:"
cat "$BASE/sbdc-entity/src/deck.rs" 2>&1 || true
echo ""
echo "deck_narrative_arc entity:"
cat "$BASE/sbdc-entity/src/deck_narrative_arc.rs" 2>&1 || true
echo ""
echo "character entity:"
cat "$BASE/sbdc-entity/src/character.rs" 2>&1 || true
echo ""
echo "clan entity:"
cat "$BASE/sbdc-entity/src/clan.rs" 2>&1 || true
echo ""
echo "Migrator file:"
find "$BASE/sbdc-migration/src/" -name "*.rs" -exec echo "--- {} ---" \; -exec cat {} \; 2>&1 || true

echo "Writing $BASE/sbdc-entity/src/take.rs"
cat > "$BASE/sbdc-entity/src/take.rs" << 'TAKE_ENTITY_K7mN2'
use sea_orm::entity::prelude::*;

#[derive(Clone, Debug, PartialEq, DeriveEntityModel)]
#[sea_orm(table_name = "take")]
pub struct Model {
    #[sea_orm(primary_key)]
    pub id: i32,
    pub prompt_id: i32,
    pub deck_id: String,
    pub take_number: i32,
    pub file_path: String,
    pub selected: bool,
    pub created_at: String,
}

#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
pub enum Relation {}

impl ActiveModelBehavior for ActiveModel {}
TAKE_ENTITY_K7mN2

echo "Writing $BASE/sbdc-dto/src/api.rs"
cat > "$BASE/sbdc-dto/src/api.rs" << 'API_DTO_X9pQ4'
use serde::{Deserialize, Serialize};

#[derive(Serialize, Debug, Clone)]
pub struct DeckStatusResponse {
    pub deck_id: String,
    pub status: String,
    pub total_prompts: i64,
    pub prompts_ready: i64,
    pub prompts_generating: i64,
    pub prompts_review: i64,
    pub prompts_done: i64,
}

#[derive(Serialize, Debug, Clone)]
pub struct PromptResponse {
    pub id: i32,
    pub target_card: String,
    pub target_layer: String,
    pub final_positive: String,
    pub final_negative: String,
    pub status: String,
}

#[derive(Deserialize, Debug, Clone)]
pub struct UpdatePromptRequest {
    pub status: String,
}

#[derive(Deserialize, Debug, Clone)]
pub struct CreateTakeRequest {
    pub image_base64: String,
    pub take_number: i32,
}

#[derive(Serialize, Debug, Clone)]
pub struct TakeResponse {
    pub id: i32,
    pub prompt_id: i32,
    pub target_card: String,
    pub target_layer: String,
    pub take_number: i32,
    pub file_path: String,
    pub selected: bool,
}

#[derive(Deserialize, Debug, Clone)]
pub struct GenerateStartRequest {
    pub takes_per_prompt: u32,
}
API_DTO_X9pQ4

echo "Patching $BASE/sbdc-dto/src/lib.rs to add api module"
if python3 - "$BASE/sbdc-dto/src/lib.rs" << 'PYEOF_DTO_LIB'
import sys
with open(sys.argv[1], 'r') as f:
    content = f.read()
if 'pub mod api;' not in content:
    content = content.rstrip() + '\npub mod api;\n'
    with open(sys.argv[1], 'w') as f:
        f.write(content)
    print("Added 'pub mod api;' to lib.rs")
else:
    print("'pub mod api;' already present")
PYEOF_DTO_LIB
then
  echo "Python patch succeeded for sbdc-dto/src/lib.rs"
else
  echo "ERROR: Python patch failed for sbdc-dto/src/lib.rs"
fi

echo "Patching $BASE/sbdc-entity/src/lib.rs to add take module"
if python3 - "$BASE/sbdc-entity/src/lib.rs" << 'PYEOF_ENT_LIB'
import sys
with open(sys.argv[1], 'r') as f:
    content = f.read()
if 'pub mod take;' not in content:
    content = content.rstrip() + '\npub mod take;\n'
    with open(sys.argv[1], 'w') as f:
        f.write(content)
    print("Added 'pub mod take;' to lib.rs")
else:
    print("'pub mod take;' already present")
PYEOF_ENT_LIB
then
  echo "Python patch succeeded for sbdc-entity/src/lib.rs"
else
  echo "ERROR: Python patch failed for sbdc-entity/src/lib.rs"
fi

echo "Adding tower-http and base64 to workspace Cargo.toml"
if python3 - "$BASE/Cargo.toml" << 'PYEOF_WS_TOML'
import sys
with open(sys.argv[1], 'r') as f:
    content = f.read()
anchor = 'thiserror = "2"'
additions = ''
if 'tower-http' not in content:
    additions += '\ntower-http = { version = "0.6", features = ["cors"] }'
if 'base64' not in content:
    additions += '\nbase64 = "0.22"'
if additions:
    content = content.replace(anchor, anchor + additions, 1)
    with open(sys.argv[1], 'w') as f:
        f.write(content)
    print("Added tower-http and/or base64 to workspace dependencies")
else:
    print("tower-http and base64 already present")
PYEOF_WS_TOML
then
  echo "Python patch succeeded for workspace Cargo.toml"
else
  echo "ERROR: Python patch failed for workspace Cargo.toml"
fi

echo "Adding tower-http and base64 to sbdc-service Cargo.toml"
if python3 - "$BASE/sbdc-service/Cargo.toml" << 'PYEOF_SVC_TOML'
import sys
path = sys.argv[1]
with open(path, 'r') as f:
    content = f.read()
additions = []
if 'tower-http' not in content:
    additions.append('tower-http = { workspace = true }')
if 'base64' not in content:
    additions.append('base64 = { workspace = true }')
if not additions:
    print("tower-http and base64 already present in sbdc-service Cargo.toml")
    sys.exit(0)
insert_text = '\n'.join(additions)
lines = content.split('\n')
new_lines = []
in_deps = False
inserted = False
for line in lines:
    stripped = line.strip()
    if stripped == '[dependencies]':
        in_deps = True
    elif in_deps and stripped.startswith('[') and not inserted:
        for add_line in additions:
            new_lines.append(add_line)
        inserted = True
        in_deps = False
    new_lines.append(line)
if in_deps and not inserted:
    for add_line in additions:
        new_lines.append(add_line)
with open(path, 'w') as f:
    f.write('\n'.join(new_lines))
print("Added " + ", ".join(additions) + " to sbdc-service Cargo.toml")
PYEOF_SVC_TOML
then
  echo "Python patch succeeded for sbdc-service Cargo.toml"
else
  echo "ERROR: Python patch failed for sbdc-service Cargo.toml"
fi

echo "Checking compilation"
if ! cargo check --workspace --manifest-path "$BASE/Cargo.toml" 2>&1; then
  echo "Compilation failed – will skip commit"
  COMPILE_OK=false
fi

if [ "$INCOMPLETE" = true ] || [ "$COMPILE_OK" = false ]; then
  echo "Skipping tests and commit due to incomplete files or compilation errors"
  exit 1
fi

echo "Running tests"
cargo test --workspace --manifest-path "$BASE/Cargo.toml" 2>&1
if [ $? -eq 0 ]; then
  echo "All tests passed. Committing."
  git add -A
  git commit -m "feat(sbdc): add take entity, API DTO types, tower-http and base64 deps"
else
  echo "Tests failed. Fix errors then run the next script."
  exit 1
fi

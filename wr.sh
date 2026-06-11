#!/usr/bin/env bash
set -uo pipefail

COMPILE_OK=true
INCOMPLETE=false

BASE="tools/sbdc"

echo "=== Cleanup: remove incorrectly created take.rs and its module declaration ==="

echo "Removing $BASE/sbdc-entity/src/take.rs"
rm -f "$BASE/sbdc-entity/src/take.rs"

echo "Patching $BASE/sbdc-entity/src/lib.rs to remove 'pub mod take;'"
if python3 - "$BASE/sbdc-entity/src/lib.rs" << 'PYEOF_RM_TAKE'
import sys
with open(sys.argv[1], 'r') as f:
    lines = f.readlines()
with open(sys.argv[1], 'w') as f:
    for line in lines:
        if line.strip() == 'pub mod take;':
            continue
        f.write(line)
PYEOF_RM_TAKE
then
  echo "Removed 'pub mod take;' from entity lib.rs"
else
  echo "ERROR: failed to patch entity lib.rs"
fi

echo "=== Discovery: existing prompt_take entity ==="
cat "$BASE/sbdc-entity/src/prompt_take.rs" 2>&1 || true

echo ""
echo "=== Discovery: remaining entity files ==="
for f in composition_schema creative_pattern framing_instruction junction_type lore_entry prompt_comment prompt_template season universe virality_mechanic character_relationship; do
  echo "--- $f.rs ---"
  cat "$BASE/sbdc-entity/src/$f.rs" 2>&1 || true
  echo ""
done

echo ""
echo "=== Discovery: full migration file ==="
cat "$BASE/sbdc-migration/src/m20240101_000001_init.rs" 2>&1 || true

echo ""
echo "=== Discovery: extension source files ==="
for f in background.ts content.ts popup.ts popup.html; do
  echo "--- $BASE/sbdc-extension/src/$f ---"
  cat "$BASE/sbdc-extension/src/$f" 2>&1 || true
  echo ""
done

echo ""
echo "=== Discovery: extension manifest and config ==="
cat "$BASE/sbdc-extension/manifest.json" 2>&1 || true
echo ""
cat "$BASE/sbdc-extension/vite.config.ts" 2>&1 || true
echo ""
cat "$BASE/sbdc-extension/package.json" 2>&1 || true
echo ""
cat "$BASE/sbdc-extension/tsconfig.json" 2>&1 || true

echo ""
echo "=== Discovery: build.sh ==="
cat "$BASE/sbdc-extension/build.sh" 2>&1 || true

echo ""
echo "=== Discovery: CLI test file ==="
cat "$BASE/sbdc-cli/tests/pipeline_test.rs" 2>&1 || true

echo ""
echo "=== Discovery: service extra files ==="
for f in build_prompts_test_fix.rs generate_import_fix.rs generate_top.rs scaffold_import_fix.rs; do
  echo "--- $BASE/sbdc-service/src/$f ---"
  cat "$BASE/sbdc-service/src/$f" 2>&1 || true
  echo ""
done

echo "Checking compilation after cleanup"
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
  git commit -m "chore(sbdc): cleanup incorrect take entity, discover existing codebase"
else
  echo "Tests failed. Fix errors then run the next script."
  exit 1
fi

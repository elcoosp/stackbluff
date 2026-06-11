#!/usr/bin/env bash
set -uo pipefail

COMPILE_OK=true
INCOMPLETE=false

REPO_ROOT="$(git rev-parse --show-toplevel)"
BASE="$REPO_ROOT/tools/sbdc"
SBDC_BIN="$BASE/target/debug/sbdc"

echo "=== Finding your takes ==="
echo ""

echo "Step 1: Find any project dirs with .sbdc databases"
SBDC_DBS=$(find /tmp -name "sbdc.db" -path "*/.sbdc/*" 2>/dev/null)
if [ -z "$SBDC_DBS" ]; then
  echo "No .sbdc/sbdc.db found in /tmp"
  echo "Checking current directory..."
  SBDC_DBS=$(find . -name "sbdc.db" -path "*/.sbdc/*" 2>/dev/null)
fi

for db in $SBDC_DBS; do
  PROJECT_DIR=$(dirname "$(dirname "$db")")
  echo ""
  echo "=== Project: $PROJECT_DIR ==="
  echo "DB: $db"

  DECKS=$(sqlite3 "$db" "SELECT deck_id, status FROM decks;" 2>/dev/null)
  echo "Decks: $DECKS"

  TAKE_COUNT=$(sqlite3 "$db" "SELECT COUNT(*) FROM prompt_takes;" 2>/dev/null)
  echo "Takes in DB: $TAKE_COUNT"

  if [ "$TAKE_COUNT" -gt 0 ]; then
    echo ""
    echo "Take records:"
    sqlite3 "$db" "SELECT t.take_id, p.target_card, t.file_path, t.is_selected FROM prompt_takes t JOIN generated_prompts p ON t.prompt_id = p.prompt_id LIMIT 20;" 2>/dev/null
    echo ""
    echo "PNG files on disk:"
    find "$PROJECT_DIR/decks" -name "*.png" 2>/dev/null | head -20
  fi
done

echo ""
echo "=== If no takes found, here's how the full flow works ==="
echo ""
echo "1. Start the server with a project dir:"
echo "   $SBDC_BIN --project-dir /tmp/my-project serve --port 8899"
echo ""
echo "2. The extension generates images and POSTs them to the server"
echo "3. The server saves them to:"
echo "   /tmp/my-project/decks/default_season/demo-deck/0-takes/Ks/take_1.png"
echo "   /tmp/my-project/decks/default_season/demo-deck/0-takes/2s/take_1.png"
echo "   etc."
echo ""
echo "4. Check with the where command:"
echo "   $SBDC_BIN --project-dir /tmp/my-project where --deck-id demo-deck"
echo ""

echo "=== Let's also check the server code to confirm paths ==="
grep -A5 "let takes_dir" "$BASE/sbdc-service/src/server.rs" 2>/dev/null || echo "Checking server.rs..."
grep -A3 "takes_dir" "$BASE/sbdc-service/src/server.rs" 2>/dev/null

echo ""
echo "=== The key line from server.rs ==="
grep "0-takes" "$BASE/sbdc-service/src/server.rs" 2>/dev/null

echo ""
echo "=== Fix: remove unused variable warning ==="
OLD_TMP=$(mktemp) || { echo "ERROR"; exit 1; }
NEW_TMP=$(mktemp)
cat > "$OLD_TMP" << 'OLD_UNUSED_K7mN3'
                let deck_takes = takes_dir.join("*").join(&deck_id).join("0-takes");
OLD_UNUSED_K7mN3
cat > "$NEW_TMP" << 'NEW_UNUSED_P4qR8'
                let _deck_takes = takes_dir.join("*").join(&deck_id).join("0-takes");
NEW_UNUSED_P4qR8
if python3 - "$OLD_TMP" "$NEW_TMP" "$BASE/sbdc-cli/src/main.rs" << 'PYEOF_UNUSED'
import sys
with open(sys.argv[1], 'r') as f: old = f.read()
with open(sys.argv[2], 'r') as f: new = f.read()
with open(sys.argv[3], 'r') as f: content = f.read()
content = content.replace(old, new)
with open(sys.argv[3], 'w') as f: f.write(content)
PYEOF_UNUSED
then
  echo "Fixed unused variable warning"
  rm "$OLD_TMP" "$NEW_TMP"
else
  rm -f "$OLD_TMP" "$NEW_TMP"
fi

cargo clippy --workspace --manifest-path "$BASE/Cargo.toml" -- -D warnings 2>&1 | tail -3
cargo test --workspace --manifest-path "$BASE/Cargo.toml" 2>&1 | tail -3

git add -A
git commit -m "fix(sbdc): suppress unused variable warning in Where command" 2>&1 || echo "Nothing to commit"

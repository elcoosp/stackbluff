#!/usr/bin/env bash
set -uo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel)"
BASE="$REPO_ROOT/tools/sbdc"
SBDC_BIN="$BASE/target/debug/sbdc"
PROJECT_DIR="$REPO_ROOT/test-project"

echo "=== Checking test-project for takes ==="
DB="$PROJECT_DIR/.sbdc/sbdc.db"

if [ -f "$DB" ]; then
  echo "✅ Found DB: $DB"
  echo ""
  echo "--- Decks ---"
  sqlite3 "$DB" "SELECT deck_id, status FROM decks;" 2>/dev/null

  echo ""
  echo "--- Takes in DB ---"
  TAKE_COUNT=$(sqlite3 "$DB" "SELECT COUNT(*) FROM prompt_takes;" 2>/dev/null)
  echo "Total takes: $TAKE_COUNT"

  if [ "$TAKE_COUNT" -gt 0 ]; then
    echo ""
    sqlite3 "$DB" "SELECT t.take_id, p.target_card, t.file_path, t.is_selected FROM prompt_takes t JOIN generated_prompts p ON t.prompt_id = p.prompt_id WHERE p.deck_id='demo-deck' LIMIT 20;" 2>/dev/null
  else
    echo "(no takes yet)"
  fi

  echo ""
  echo "--- PNG files on disk ---"
  find "$PROJECT_DIR/decks" -name "*.png" -exec ls -la {} \; 2>/dev/null | head -30

  echo ""
  echo "--- Prompt statuses ---"
  sqlite3 "$DB" "SELECT status, COUNT(*) FROM generated_prompts WHERE deck_id='demo-deck' GROUP BY status;" 2>/dev/null
else
  echo "No DB at $DB"
fi

echo ""
echo "=== Updating demo.sh to use test-project ==="
echo "The server was started from test-project/, not /tmp"
echo "Let's make the demo script use a visible location"

cat > "$BASE/sbdc-cli/src/demo.sh" << 'DEMO_V4_Q2mK6'
#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel)"
SBDC_BIN="$REPO_ROOT/tools/sbdc/target/debug/sbdc"
EXT_DIR="$REPO_ROOT/tools/sbdc/sbdc-extension"
DEMO_DIR="$REPO_ROOT/sbdc-workspace"

echo "╔══════════════════════════════════════════════════════════════╗"
echo "║     SBDC Demo — Full End-to-End Setup & Extension Guide     ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""
echo "Project dir: $DEMO_DIR"
echo ""

mkdir -p "$DEMO_DIR"

echo "═══════════════════════════════════════════════════════"
echo "  STEP 0: Build the sbdc binary"
echo "═══════════════════════════════════════════════════════"
cargo build --bin sbdc --manifest-path "$REPO_ROOT/tools/sbdc/Cargo.toml" 2>&1 | tail -2
echo "✅ Binary built"
echo ""

echo "═══════════════════════════════════════════════════════"
echo "  STEP 1: Init"
echo "═══════════════════════════════════════════════════════"
"$SBDC_BIN" --project-dir "$DEMO_DIR" init 2>&1 | tail -1

echo ""
echo "═══════════════════════════════════════════════════════"
echo "  STEP 2: Scaffold"
echo "═══════════════════════════════════════════════════════"
"$SBDC_BIN" --project-dir "$DEMO_DIR" scaffold --deck-id demo-deck --season-id default_season 2>&1 | tail -1

echo ""
echo "═══════════════════════════════════════════════════════"
echo "  STEP 3: Build Prompts"
echo "═══════════════════════════════════════════════════════"
"$SBDC_BIN" --project-dir "$DEMO_DIR" build-prompts --deck-id demo-deck 2>&1 | tail -1

PROMPT_COUNT=$(sqlite3 "$DEMO_DIR/.sbdc/sbdc.db" "SELECT COUNT(*) FROM generated_prompts WHERE deck_id='demo-deck' AND status='ready_to_generate';" 2>/dev/null)
echo "✅ $PROMPT_COUNT prompts ready"
echo ""

echo "═══════════════════════════════════════════════════════"
echo "  STEP 4: Start the server"
echo "═══════════════════════════════════════════════════════"
echo "Run this in a separate terminal:"
echo ""
echo "  $SBDC_BIN --project-dir $DEMO_DIR serve --port 8899"
echo ""
echo "Then use the Chrome extension to start generation."
echo ""
echo "After generation, takes will be at:"
echo "  $DEMO_DIR/decks/default_season/demo-deck/0-takes/"
echo ""
echo "Check with:"
echo "  $SBDC_BIN --project-dir $DEMO_DIR where --deck-id demo-deck"
echo ""
echo "Or list files:"
echo "  find $DEMO_DIR/decks -name '*.png'"
DEMO_V4_Q2mK6
chmod +x "$BASE/sbdc-cli/src/demo.sh"

echo "Committing"
rm -f "$REPO_ROOT/.git/index.lock"
git add -A
git commit -m "fix(sbdc): update demo.sh to use visible sbdc-workspace dir

Use REPO_ROOT/sbdc-workspace/ instead of /tmp so files persist
and are easy to find." 2>&1 || echo "Nothing new to commit"

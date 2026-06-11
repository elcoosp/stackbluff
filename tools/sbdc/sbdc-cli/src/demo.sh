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

#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel)"
SBDC_BIN="$REPO_ROOT/tools/sbdc/target/debug/sbdc"
EXT_DIR="$REPO_ROOT/tools/sbdc/sbdc-extension"
DEMO_DIR=$(mktemp -d /tmp/sbdc-demo-XXXXXX)

echo "╔══════════════════════════════════════════════════════════════╗"
echo "║     SBDC Demo — Full End-to-End Setup & Extension Guide     ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""
echo "Repo root:     $REPO_ROOT"
echo "Demo dir:      $DEMO_DIR"
echo "Extension dir: $EXT_DIR"
echo ""

echo "═══════════════════════════════════════════════════════"
echo "  STEP 0: Build the sbdc binary"
echo "═══════════════════════════════════════════════════════"
cargo build --bin sbdc --manifest-path "$REPO_ROOT/tools/sbdc/Cargo.toml" 2>&1
echo "✅ Binary built"
echo ""

echo "═══════════════════════════════════════════════════════"
echo "  STEP 1: Build the Chrome extension"
echo "═══════════════════════════════════════════════════════"
cd "$EXT_DIR"
bash build.sh 2>&1 || { echo "⚠️  Extension build may have issues"; }
cd "$DEMO_DIR"
echo ""

echo "═══════════════════════════════════════════════════════"
echo "  STEP 2: Init"
echo "═══════════════════════════════════════════════════════"
"$SBDC_BIN" --project-dir "$DEMO_DIR" init
echo ""

echo "═══════════════════════════════════════════════════════"
echo "  STEP 3: Scaffold"
echo "═══════════════════════════════════════════════════════"
"$SBDC_BIN" --project-dir "$DEMO_DIR" scaffold --deck-id demo-deck --season-id default_season
echo ""

echo "═══════════════════════════════════════════════════════"
echo "  STEP 4: Ingest sample lore"
echo "═══════════════════════════════════════════════════════"
cat > "$DEMO_DIR/demo-lore.json" << 'LORE_EMBED'
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
    { "rank": "2", "suit": "s", "description": "Spade scouts breach the crystal wall" },
    { "rank": "A", "suit": "h", "description": "The Heart Queen makes the ultimate sacrifice" }
  ]
}
LORE_EMBED
"$SBDC_BIN" --project-dir "$DEMO_DIR" ingest-json --deck-id demo-deck --file "$DEMO_DIR/demo-lore.json"
echo ""

echo "═══════════════════════════════════════════════════════"
echo "  STEP 5: Build Prompts"
echo "═══════════════════════════════════════════════════════"
"$SBDC_BIN" --project-dir "$DEMO_DIR" build-prompts --deck-id demo-deck
echo ""

PROMPT_COUNT=$(sqlite3 "$DEMO_DIR/.sbdc/sbdc.db" "SELECT COUNT(*) FROM generated_prompts WHERE deck_id='demo-deck' AND status='ready_to_generate';" 2>/dev/null || echo "?")
echo "✅ $PROMPT_COUNT prompts ready to generate"
echo ""

echo "═══════════════════════════════════════════════════════"
echo "  STEP 6: Start the server"
echo "═══════════════════════════════════════════════════════"
"$SBDC_BIN" --project-dir "$DEMO_DIR" serve --port 8899 &
SERVER_PID=$!
echo "Server PID: $SERVER_PID"
sleep 2
curl -s http://localhost:8899/api/decks/demo-deck/status | python3 -m json.tool 2>/dev/null || echo "(server starting...)"
echo ""

echo "╔══════════════════════════════════════════════════════════════╗"
echo "║         CHROME EXTENSION SETUP INSTRUCTIONS                 ║"
echo "╠══════════════════════════════════════════════════════════════╣"
echo "║                                                              ║"
echo "║  1. Open Chrome → chrome://extensions/                       ║"
echo "║  2. Enable Developer mode (top-right toggle)                 ║"
echo "║  3. Click 'Load unpacked'                                   ║"
echo "║  4. Select THIS directory:                                   ║"
echo "║     $EXT_DIR/dist"
echo "║                                                              ║"
echo "║  5. You should see 'SBDC Generator' in extensions list       ║"
echo "║                                                              ║"
echo "║  6. Open NEW TAB → https://perchance.org/fluxgen            ║"
echo "║                                                              ║"
echo "║  7. Click the SBDC puzzle piece icon in Chrome toolbar       ║"
echo "║                                                              ║"
echo "║  8. In popup enter:                                          ║"
echo "║     Server URL:  http://localhost:8899                        ║"
echo "║     Deck ID:     demo-deck                                   ║"
echo "║     Takes:       4                                           ║"
echo "║                                                              ║"
echo "║  9. Click 'Start' → 'Started! 52 prompts ready'             ║"
echo "║                                                              ║"
echo "║ 10. Content script auto-generates on the perchance page      ║"
echo "║     Look for green [SBDC] indicator at top-left              ║"
echo "║                                                              ║"
echo "║  11. After generation, review and select takes:              ║"
echo "║      curl http://localhost:8899/api/decks/demo-deck/takes    ║"
echo "║                                                              ║"
echo "║  12. Finalize:                                               ║"
echo "║      $SBDC_BIN --project-dir $DEMO_DIR clean --deck-id demo-deck"
echo "║                                                              ║"
echo "║  Stop server: kill $SERVER_PID                                ║"
echo "║  Reset:      rm -rf $DEMO_DIR                                 ║"
echo "║                                                              ║"
echo "╚══════════════════════════════════════════════════════════════╝"

wait $SERVER_PID

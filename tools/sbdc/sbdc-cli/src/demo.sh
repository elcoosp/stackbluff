#!/usr/bin/env bash
set -euo pipefail

echo "╔══════════════════════════════════════════════════════════════╗"
echo "║     SBDC Demo — Full End-to-End Setup & Extension Guide     ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""

REPO_ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
SBDC_BIN="$REPO_ROOT/tools/sbdc/target/debug/sbdc"
EXT_DIR="$REPO_ROOT/tools/sbdc/sbdc-extension"
DEMO_DIR=$(mktemp -d /tmp/sbdc-demo-XXXXXX)

echo "Demo project directory: $DEMO_DIR"
echo ""

echo "═══════════════════════════════════════════════════════"
echo "  STEP 0: Build the sbdc binary"
echo "═══════════════════════════════════════════════════════"
cargo build --bin sbdc --manifest-path "$REPO_ROOT/tools/sbdc/Cargo.toml" 2>&1
echo "✅ Binary built: $SBDC_BIN"
echo ""

echo "═══════════════════════════════════════════════════════"
echo "  STEP 1: Build the Chrome extension"
echo "═══════════════════════════════════════════════════════"
cd "$EXT_DIR"
if [ -f build.sh ]; then
  bash build.sh 2>&1 || { echo "⚠️  Extension build failed — make sure pnpm is installed"; }
else
  pnpm install 2>&1 && pnpm run build 2>&1 || { echo "⚠️  Extension build failed"; }
fi
echo "✅ Extension built in: $EXT_DIR/dist/"
echo ""

cd "$DEMO_DIR"

echo "═══════════════════════════════════════════════════════"
echo "  STEP 2: Init — seeds universe, clans, characters"
echo "═══════════════════════════════════════════════════════"
"$SBDC_BIN" --project-dir "$DEMO_DIR" init
echo ""

echo "═══════════════════════════════════════════════════════"
echo "  STEP 3: Scaffold — creates 52 prompt slots + arcs"
echo "═══════════════════════════════════════════════════════"
"$SBDC_BIN" --project-dir "$DEMO_DIR" scaffold --deck-id demo-deck --season-id default_season
echo ""

echo "═══════════════════════════════════════════════════════"
echo "  STEP 4: (Optional) Ingest custom lore"
echo "═══════════════════════════════════════════════════════"
INGEST_FILE="$DEMO_DIR/demo-lore.json"
cat > "$INGEST_FILE" << 'INGEST_JSON_Q7mL2'
{
  "lore_entries": [
    {
      "parent_entity": "deck",
      "parent_id": "demo-deck",
      "category": "history",
      "title": "The Great Schism",
      "content": "The four clans once lived in harmony until the Great Schism split them forever",
      "source": "manual",
      "status": "approved",
      "injectable": true,
      "injection_weight": 10
    },
    {
      "parent_entity": "deck",
      "parent_id": "demo-deck",
      "category": "geography",
      "title": "The Shard Mountains",
      "content": "Towering crystal peaks that separate the clan territories",
      "source": "manual",
      "status": "approved",
      "injectable": true,
      "injection_weight": 5
    }
  ],
  "narrative_arcs": [
    { "rank": "2", "suit": "s", "description": "Spade scouts breach the crystal wall under cover of storm" },
    { "rank": "3", "suit": "s", "description": "A lone soldier discovers the hidden passage through the mountains" },
    { "rank": "A", "suit": "h", "description": "The Heart Queen makes the ultimate sacrifice for peace" },
    { "rank": "K", "suit": "d", "description": "The Diamond King opens the vault and reveals the ancient treaty" }
  ]
}
INGEST_JSON_Q7mL2
"$SBDC_BIN" --project-dir "$DEMO_DIR" ingest-json --deck-id demo-deck --file "$INGEST_FILE"
echo ""

echo "═══════════════════════════════════════════════════════"
echo "  STEP 5: Build Prompts — assembles final_positive"
echo "═══════════════════════════════════════════════════════"
"$SBDC_BIN" --project-dir "$DEMO_DIR" build-prompts --deck-id demo-deck
echo ""

echo "═══════════════════════════════════════════════════════"
echo "  STEP 6: Verify prompts were created"
echo "═══════════════════════════════════════════════════════"
sqlite3 "$DEMO_DIR/.sbdc/sbdc.db" "SELECT target_card, target_layer, status, substr(final_positive, 1, 60) FROM generated_prompts WHERE deck_id='demo-deck' ORDER BY target_card LIMIT 10;"
PROMPT_COUNT=$(sqlite3 "$DEMO_DIR/.sbdc/sbdc.db" "SELECT COUNT(*) FROM generated_prompts WHERE deck_id='demo-deck' AND status='ready_to_generate';")
echo ""
echo "✅ $PROMPT_COUNT prompts ready to generate"
echo ""

echo "═══════════════════════════════════════════════════════"
echo "  STEP 7: Start the server"
echo "═══════════════════════════════════════════════════════"
echo "Starting server in background on port 8899..."
"$SBDC_BIN" --project-dir "$DEMO_DIR" serve --port 8899 &
SERVER_PID=$!
echo "Server PID: $SERVER_PID"
sleep 2

echo "Verifying server is responding..."
curl -s http://localhost:8899/api/decks/demo-deck/status | python3 -m json.tool 2>/dev/null || echo "(server may still be starting)"
echo ""

echo "╔══════════════════════════════════════════════════════════════╗"
echo "║         CHROME EXTENSION SETUP INSTRUCTIONS                 ║"
echo "╠══════════════════════════════════════════════════════════════╣"
echo "║                                                              ║"
echo "║  1. Open Chrome and go to: chrome://extensions/              ║"
echo "║                                                              ║"
echo "║  2. Enable 'Developer mode' (toggle in top-right corner)     ║"
echo "║                                                              ║"
echo "║  3. Click 'Load unpacked'                                   ║"
echo "║                                                              ║"
echo "║  4. Navigate to and select this directory:                   ║"
echo "║     $EXT_DIR/dist"
echo "║                                                              ║"
echo "║  5. You should see 'SBDC Generator' in your extensions list  ║"
echo "║                                                              ║"
echo "║  6. Open a NEW TAB and go to:                                ║"
echo "║     https://perchance.org/fluxgen                            ║"
echo "║                                                              ║"
echo "║  7. Click the SBDC puzzle piece icon in Chrome toolbar       ║"
echo "║                                                              ║"
echo "║  8. In the popup, enter:                                     ║"
echo "║     Server URL:  http://localhost:8899                        ║"
echo "║     Deck ID:     demo-deck                                   ║"
echo "║     Takes:       4                                           ║"
echo "║                                                              ║"
echo "║  9. Click 'Start' — this loads prompts into the queue        ║"
echo "║     You should see: 'Started! 52 prompts ready'              ║"
echo "║                                                              ║"
echo "║ 10. Click 'Status' to verify:                                ║"
echo "║     You should see ready_to_generate: 52                     ║"
echo "║                                                              ║"
echo "║ 11. The content script on the perchance page will            ║"
echo "║     AUTOMATICALLY begin generating:                          ║"
echo "║     - Fetches next prompt from server                        ║"
echo "║     - Fills positive/negative textareas                      ║"
echo "║     - Clicks Generate                                        ║"
echo "║     - Waits for images to render                             ║"
echo "║     - Submits takes back to server                           ║"
echo "║     - Repeats until all 52 prompts are done                  ║"
echo "║                                                              ║"
echo "║ 12. Watch progress in the perchance tab — you'll see a       ║"
echo "║     green indicator at top-left showing which card is        ║"
echo "║     being generated                                          ║"
echo "║                                                              ║"
echo "║ 13. Check progress anytime with 'Status' button in popup     ║"
echo "║                                                              ║"
echo "╠══════════════════════════════════════════════════════════════╣"
echo "║         AFTER GENERATION: REVIEW & SELECT TAKES              ║"
echo "╠══════════════════════════════════════════════════════════════╣"
echo "║                                                              ║"
echo "║  14. View all takes:                                         ║"
echo "║      curl http://localhost:8899/api/decks/demo-deck/takes    ║"
echo "║                                                              ║"
echo "║  15. Select the best take for each prompt:                   ║"
echo "║      curl -X POST http://localhost:8899/api/decks/           ║"
echo "║        demo-deck/takes/{TAKE_ID}/select                      ║"
echo "║                                                              ║"
echo "║  16. When done selecting, finalize:                          ║"
echo "║      $SBDC_BIN --project-dir $DEMO_DIR clean --deck-id demo-deck"
echo "║                                                              ║"
echo "║  17. Find final images in:                                   ║"
echo "║      $DEMO_DIR/decks/default_season/demo-deck/3-clean/"
echo "║                                                              ║"
echo "╠══════════════════════════════════════════════════════════════╣"
echo "║         TROUBLESHOOTING                                      ║"
echo "╠══════════════════════════════════════════════════════════════╣"
echo "║                                                              ║"
echo "║  • Extension not loading? Make sure you selected dist/ NOT  ║"
echo "║    the sbdc-extension root folder                            ║"
echo "║                                                              ║"
echo "║  • Content script not running? Refresh the perchance page   ║"
echo "║    after loading the extension                               ║"
echo "║                                                              ║"
echo "║  • No green indicator? Open DevTools Console (F12) on the   ║"
echo "║    perchance page and look for [SBDC] log lines             ║"
echo "║                                                              ║"
echo "║  • Server not reachable? Check it's running:                ║"
echo "║    curl http://localhost:8899/api/decks/demo-deck/status     ║"
echo "║                                                              ║"
echo "║  • To stop the server: kill $SERVER_PID                      ║"
echo "║    or: pkill -f 'sbdc.*serve'                               ║"
echo "║                                                              ║"
echo "║  • To reset everything: rm -rf $DEMO_DIR                     ║"
echo "║    and re-run this script                                    ║"
echo "║                                                              ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""
echo "Demo project: $DEMO_DIR"
echo "Server PID:   $SERVER_PID"
echo "Extension:    $EXT_DIR/dist/"
echo ""
echo "Server is running. Press Ctrl+C to stop."
echo ""

wait $SERVER_PID

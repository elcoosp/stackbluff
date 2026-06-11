#!/usr/bin/env bash
set -uo pipefail

COMPILE_OK=true
INCOMPLETE=false

echo "=== Diagnosing CWD and repo root ==="
echo "CWD: $(pwd)"
REPO_ROOT="$(git rev-parse --show-toplevel)"
echo "Git repo root: $REPO_ROOT"
echo "Cargo.toml exists: $(test -f $REPO_ROOT/tools/sbdc/Cargo.toml && echo YES || echo NO)"
echo "Extension dir exists: $(test -d $REPO_ROOT/tools/sbdc/sbdc-extension && echo YES || echo NO)"

BASE="$REPO_ROOT/tools/sbdc"
EXT_DIR="$BASE/sbdc-extension"

echo ""
echo "=== Fixing manifest.json with .ts source paths ==="
cat > "$EXT_DIR/manifest.json" << 'MANIFEST_V4_Q7kP1'
{
  "manifest_version": 3,
  "name": "SBDC Generator",
  "version": "1.0",
  "permissions": [
    "storage"
  ],
  "host_permissions": [
    "http://localhost:*/*"
  ],
  "background": {
    "service_worker": "src/background.ts",
    "type": "module"
  },
  "content_scripts": [
    {
      "matches": [
        "*://*.perchance.org/*"
      ],
      "js": [
        "src/content.ts"
      ],
      "run_at": "document_idle",
      "all_frames": true
    }
  ],
  "action": {
    "default_popup": "src/popup.html"
  }
}
MANIFEST_V4_Q7kP1
echo "Wrote manifest.json"

echo ""
echo "=== Cleaning dist and rebuilding extension ==="
rm -rf "$EXT_DIR/dist"
(cd "$EXT_DIR" && pnpm run build 2>&1)

echo ""
echo "=== Build output ==="
echo "Dist tree:"
find "$EXT_DIR/dist" -type f | sort

echo ""
echo "Generated manifest.json:"
cat "$EXT_DIR/dist/manifest.json" 2>&1

echo ""
echo "Verifying all 3 entry points..."
BG_COUNT=$(find "$EXT_DIR/dist" -name "*background*" -type f 2>/dev/null | wc -l | tr -d ' ')
CT_COUNT=$(find "$EXT_DIR/dist" -name "*content*" -type f 2>/dev/null | wc -l | tr -d ' ')
POP_COUNT=$(find "$EXT_DIR/dist" -name "*popup*" -type f 2>/dev/null | wc -l | tr -d ' ')
echo "  background files: $BG_COUNT"
echo "  content files:    $CT_COUNT"
echo "  popup files:      $POP_COUNT"

if [ "$BG_COUNT" -gt 0 ] && [ "$CT_COUNT" -gt 0 ] && [ "$POP_COUNT" -gt 0 ]; then
  echo "  ✅ All entry points present"
else
  echo "  ❌ Some entry points missing — extension may not work"
fi

echo ""
echo "=== Updating build.sh ==="
cat > "$EXT_DIR/build.sh" << 'BUILDSH_V5_M3nR9'
#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"

echo "Installing dependencies..."
pnpm install --frozen-lockfile 2>/dev/null || pnpm install

echo "Building extension..."
pnpm run build

echo ""
echo "Build complete. Files in dist/:"
find dist -type f | sort

echo ""
echo "Load in Chrome: chrome://extensions/ → Developer mode → Load unpacked → select dist/"
BUILDSH_V5_M3nR9
chmod +x "$EXT_DIR/build.sh"

echo ""
echo "=== Updating demo.sh with correct paths ==="
cat > "$BASE/sbdc-cli/src/demo.sh" << 'DEMO_V3_K8jW4'
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
DEMO_V3_K8jW4
chmod +x "$BASE/sbdc-cli/src/demo.sh"

echo "Checking Rust compilation"
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
  git commit -m "fix(sbdc): use git rev-parse for repo root, fix all absolute path issues

- Use git rev-parse --show-toplevel instead of dirname traversal
- Fix manifest.json with .ts source paths for @crxjs
- Fix demo.sh, build.sh with correct path resolution
- Rebuild extension and verify all 3 entry points in dist/"
else
  echo "Tests failed. Fix errors then run the next script."
  exit 1
fi

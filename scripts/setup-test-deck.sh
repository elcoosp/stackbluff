#!/usr/bin/env bash
set -euo pipefail

# Script to set up a test deck for the SBDC extension pipeline.
# Usage: ./setup-test-deck.sh [--clean] [--project-dir DIR]

# Find the repository root (where tools/ and scripts/ live)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$REPO_ROOT"

# Default values
PROJECT_DIR="${PROJECT_DIR:-$REPO_ROOT/test-project}"
CLEAN=false
DECK_ID="${DECK_ID:-test-deck}"
SEASON_ID="${SEASON_ID:-default_season}"
PORT="${PORT:-8899}"

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --clean) CLEAN=true; shift ;;
        --project-dir) PROJECT_DIR="$2"; shift 2 ;;
        --deck-id) DECK_ID="$2"; shift 2 ;;
        --season-id) SEASON_ID="$2"; shift 2 ;;
        --port) PORT="$2"; shift 2 ;;
        *) echo "Unknown option: $1"; exit 1 ;;
    esac
done

# Ensure we have a compiled sbdc binary
echo "🔨 Building sbdc CLI from $REPO_ROOT/tools/sbdc..."
cd "$REPO_ROOT/tools/sbdc"
cargo build --bin sbdc --release --quiet
SBDC_BIN="$REPO_ROOT/tools/sbdc/target/release/sbdc"

if [ ! -f "$SBDC_BIN" ]; then
    echo "❌ Failed to build sbdc binary"
    exit 1
fi

cd "$REPO_ROOT"

# Clean project directory if requested
if [ "$CLEAN" = true ] && [ -d "$PROJECT_DIR" ]; then
    echo "🧹 Cleaning existing project directory: $PROJECT_DIR"
    rm -rf "$PROJECT_DIR"
fi

mkdir -p "$PROJECT_DIR"
cd "$PROJECT_DIR"
echo "📁 Using project directory: $(pwd)"

# Initialize
echo "📦 Initializing SBDC project..."
"$SBDC_BIN" --project-dir . init

# Scaffold deck
echo "🏗️ Scaffolding deck '$DECK_ID'..."
"$SBDC_BIN" --project-dir . scaffold --deck-id "$DECK_ID" --season-id "$SEASON_ID"

# Create a sample ingest.json file
echo "📝 Creating sample ingest data..."
cat > ingest.json << 'EOF'
{
  "lore_entries": [
    {
      "parent_entity": "deck",
      "parent_id": "test-deck",
      "category": "history",
      "title": "The Great War",
      "content": "The clans fought for control of the mystical shards. The Spades invaded with iron legions, the Hearts resisted with guerrilla tactics, the Diamonds traded secrets, and the Clubs fortified their mountain holds.",
      "source": "test",
      "status": "approved",
      "injectable": true,
      "injection_weight": 5
    },
    {
      "parent_entity": "deck",
      "parent_id": "test-deck",
      "category": "character",
      "title": "Spade King's Motivation",
      "content": "The Spade King seeks the shard of dominion to unite all clans under his rule, believing only absolute order can prevent eternal war.",
      "source": "test",
      "status": "approved",
      "injectable": true,
      "injection_weight": 10
    }
  ],
  "narrative_arcs": [
    {"rank": "2", "suit": "s", "description": "Scouts report enemy movement near the pass."},
    {"rank": "3", "suit": "s", "description": "A small skirmish erupts; the Spades gain ground."},
    {"rank": "4", "suit": "s", "description": "The clan rallies under the king's banner."},
    {"rank": "5", "suit": "s", "description": "Siege weapons are brought forward."},
    {"rank": "10", "suit": "h", "description": "The Resistance learns of a secret tunnel."},
    {"rank": "J", "suit": "h", "description": "A heart queen's sacrifice inspires the defenders."}
  ]
}
EOF

# Ingest the JSON
echo "📥 Ingesting test lore and arcs..."
"$SBDC_BIN" --project-dir . ingest-json --deck-id "$DECK_ID" --file ingest.json

# Build prompts
echo "🔨 Building prompts..."
"$SBDC_BIN" --project-dir . build-prompts --deck-id "$DECK_ID"

echo ""
echo "════════════════════════════════════════════════════════════"
echo "✅ Test deck '$DECK_ID' is ready!"
echo "════════════════════════════════════════════════════════════"
echo ""
echo "📂 Project location: $PROJECT_DIR"
echo ""
echo "🚀 To test the extension:"
echo ""
echo "1. Build the Chrome extension:"
echo "   cd $REPO_ROOT/tools/sbdc/sbdc-extension && ./build.sh"
echo ""
echo "2. Load the extension in Chrome:"
echo "   - Open chrome://extensions/"
echo "   - Enable Developer mode"
echo "   - Click 'Load unpacked' and select: $REPO_ROOT/tools/sbdc/sbdc-extension/dist"
echo ""
echo "3. Start the SBDC server (from this project directory):"
echo "   cd $PROJECT_DIR"
echo "   $SBDC_BIN serve --deck-id $DECK_ID --port $PORT"
echo ""
echo "4. Open https://perchance.org/fluxgen in Chrome"
echo ""
echo "5. Click the extension icon, set server URL to: http://localhost:$PORT"
echo "   Set Deck ID: $DECK_ID"
echo "   Set Takes: 2 (or more)"
echo "   Click Start Generation"
echo ""
echo "The extension will automatically process all prompts and save images to:"
echo "   $PROJECT_DIR/decks/$SEASON_ID/$DECK_ID/0-takes/"
echo ""
echo "════════════════════════════════════════════════════════════"

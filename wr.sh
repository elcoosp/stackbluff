#!/usr/bin/env bash
set -uo pipefail

echo "Cleaning up backup files and providing final summary"

cd /Users/adm/Documents/Repos/stackbluff || { echo "ERROR: cannot cd to repo root"; exit 1; }

# Remove backup files
rm -f tools/sbdc/sbdc-cli/src/main.rs.bak
rm -f wr.sh.bak 2>/dev/null || true

# Remove any other .bak files in tools/sbdc
find tools/sbdc -name "*.bak" -type f -delete 2>/dev/null || true

echo "Backup files removed."

# Ensure all changes are committed (if any remain)
git add -A
if ! git diff --cached --quiet; then
    git commit -m "chore: remove backup files and finalize sbdc-gen-node removal"
else
    echo "No additional changes to commit."
fi

echo ""
echo "════════════════════════════════════════════════════════════"
echo "✅ Migration complete!"
echo "════════════════════════════════════════════════════════════"
echo ""
echo "What was done:"
echo "  • Removed sbdc-gen-node (Node bridge) completely"
echo "  • Added axum HTTP server to sbdc-service"
echo "  • Created Chrome extension with Vite + CRXJS"
echo "  • Updated CLI with 'serve' command"
echo ""
echo "To use the new pipeline:"
echo ""
echo "1. Build the extension:"
echo "   cd tools/sbdc/sbdc-extension && ./build.sh"
echo ""
echo "2. Load extension in Chrome:"
echo "   chrome://extensions/ → Developer mode → Load unpacked"
echo "   Select tools/sbdc/sbdc-extension/dist"
echo ""
echo "3. Start the Rust server for your deck:"
echo "   cd tools/sbdc"
echo "   cargo run --bin sbdc -- serve --deck YOUR_DECK_ID --port 8899"
echo ""
echo "4. Open https://perchance.org/fluxgen in Chrome"
echo ""
echo "5. Click extension icon, set server URL (http://localhost:8899),"
echo "   deck ID, takes, and click Start Generation."
echo ""
echo "The extension will automatically fill prompts, generate images,"
echo "and save them to decks/<season>/<deck_id>/0-takes/"
echo ""
echo "════════════════════════════════════════════════════════════"

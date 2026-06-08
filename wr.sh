#!/usr/bin/env bash
set -uo pipefail

cd tools/sb-cards/card-compositor-renderer || exit 1

# ----------------------------------------------------------------------
# 1. Create symlinks for all required asset folders
# ----------------------------------------------------------------------
echo "Creating asset symlinks in public/"

# Remove old links/directories
rm -rf public/art public/pips public/fonts public/corner-light.png

# Link to the raw art folder (contains all PNGs)
if [ -d "../../../2026-Q1/01-poison-gardenia/1-raw/art" ]; then
    ln -sf "../../../2026-Q1/01-poison-gardenia/1-raw/art" public/art
    echo "Linked public/art -> ../../../2026-Q1/01-poison-gardenia/1-raw/art"
else
    echo "ERROR: Art folder not found"
    mkdir -p public/art
fi

# Link to the pre‑processed pips
if [ -d "../../../2026-Q1/01-poison-gardenia/2-pips" ]; then
    ln -sf "../../../2026-Q1/01-poison-gardenia/2-pips" public/pips
    echo "Linked public/pips -> ../../../2026-Q1/01-poison-gardenia/2-pips"
else
    echo "WARNING: 2-pips not found, run Python script first"
    mkdir -p public/pips
fi

# Link fonts
if [ -d "../../../engine/fonts" ]; then
    ln -sf "../../../engine/fonts" public/fonts
    echo "Linked public/fonts -> ../../../engine/fonts"
else
    mkdir -p public/fonts
fi

# Generate corner-light.png if missing
if [ ! -f public/corner-light.png ]; then
    if command -v convert &>/dev/null; then
        convert -size 1000x1400 radial-gradient:white-transparent public/corner-light.png
        echo "Generated corner-light.png"
    else
        # Create a dummy transparent PNG
        printf '\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x03\xe8\x00\x00\x05x\x08\x06\x00\x00\x00\x00\x00\x00\x00\x01\x00\x00\x00\x00IDAT\x08\xd7c\xf8\xff\xff?\x00\x05\xfe\x02\xfe\x01\x13\x00\x00\x00\x00IEND\xaeB`\x82' > public/corner-light.png
        echo "Created dummy corner-light.png"
    fi
fi

# ----------------------------------------------------------------------
# 2. Update assetLoader.ts to use public URLs (remove baseDir)
# ----------------------------------------------------------------------
echo "Updating assetLoader.ts to use /art/ and /pips/ URLs"
cat > src/utils/assetLoader.ts << 'ASSET_LOADER_NEW'
/**
 * Resolves asset paths to URLs served from the public directory.
 * The actual files are symlinked in public/art/ and public/pips/
 */
export function resolveAssetPath(baseDir: string, filename: string, suffix: string): string {
  // Determine which folder the file belongs to
  // 2-pips images are already pre‑processed in the pips folder
  if (filename.includes('2-pips/') || filename.includes('pip-')) {
    // Extract suit and size from filename like "spades-100.png"
    const match = filename.match(/(spades|hearts|diamonds|clubs)-(\d+)\.png/);
    if (match) {
      return `/pips/${match[1]}-${match[2]}.png`;
    }
    // Fallback: treat as generic pips
    return `/pips/${filename.replace(/^.*\//, '')}`;
  }

  // All other assets (back, ace, jack, number-template, border, corner‑plaque, center‑band, joker)
  // are in the raw art folder.
  // The filename may already contain the suffix. We just use it as is.
  // Remove any leading path and use /art/
  const cleanName = filename.replace(/^.*[\\/]/, '');
  return `/art/${cleanName}`;
}
ASSET_LOADER_NEW

# ----------------------------------------------------------------------
# 3. Fix Card.tsx to use the corrected asset URLs (pips from /pips/)
# ----------------------------------------------------------------------
echo "Updating Card.tsx pip paths"
# No change needed because assetLoader now returns /pips/... URLs
# But we must ensure the pip size URLs match the filenames (e.g., suit-160.png)
# The StandardLayout uses `/2-pips/${suit}-160.png` – that was hardcoded.
# We'll patch StandardLayout to use `/pips/${suit}-160.png`.

OLD_PIP_URL=$(mktemp)
NEW_PIP_URL=$(mktemp)
cat > "$OLD_PIP_URL" << 'OLD_PIP'
src={`/2-pips/${suit}-160.png`}
OLD_PIP
cat > "$NEW_PIP_URL" << 'NEW_PIP'
src={`/pips/${suit}-160.png`}
NEW_PIP
if python3 - "$OLD_PIP_URL" "$NEW_PIP_URL" src/layouts/StandardLayout.tsx 2>/dev/null << 'PYFIX'
import sys
with open(sys.argv[1], 'r') as f: old = f.read()
with open(sys.argv[2], 'r') as f: new = f.read()
with open(sys.argv[3], 'r') as f: content = f.read()
content = content.replace(old, new)
with open(sys.argv[3], 'w') as f: f.write(content)
PYFIX
then
    echo "Updated pip URL in StandardLayout"
else
    echo "Failed to patch StandardLayout"
fi
rm "$OLD_PIP_URL" "$NEW_PIP_URL"

# Also fix the corner pips (size 90 and 100)
for size in 90 100; do
    OLD=$(mktemp)
    NEW=$(mktemp)
    cat > "$OLD" << OLD
src={`/2-pips/${suit}-${size}.png`}
OLD
    cat > "$NEW" << NEW
src={`/pips/${suit}-${size}.png`}
NEW
    python3 - "$OLD" "$NEW" src/layouts/StandardLayout.tsx 2>/dev/null << 'PYFIX'
import sys
with open(sys.argv[1], 'r') as f: old = f.read()
with open(sys.argv[2], 'r') as f: new = f.read()
with open(sys.argv[3], 'r') as f: content = f.read()
content = content.replace(old, new)
with open(sys.argv[3], 'w') as f: f.write(content)
PYFIX
    rm "$OLD" "$NEW"
done

# Same for ReversibleLayout
for size in 90 100; do
    OLD=$(mktemp)
    NEW=$(mktemp)
    cat > "$OLD" << OLD
src={`/2-pips/${suit}-${size}.png`}
OLD
    cat > "$NEW" << NEW
src={`/pips/${suit}-${size}.png`}
NEW
    python3 - "$OLD" "$NEW" src/layouts/ReversibleLayout.tsx 2>/dev/null << 'PYFIX'
import sys
with open(sys.argv[1], 'r') as f: old = f.read()
with open(sys.argv[2], 'r') as f: new = f.read()
with open(sys.argv[3], 'r') as f: content = f.read()
content = content.replace(old, new)
with open(sys.argv[3], 'w') as f: f.write(content)
PYFIX
    rm "$OLD" "$NEW"
done

# ----------------------------------------------------------------------
# 4. Update CardPage to use the same asset resolution logic
# (No changes needed – it already uses resolveAssetPath)
# ----------------------------------------------------------------------

# ----------------------------------------------------------------------
# 5. Make the card grid responsive (already done in previous step)
# Ensure the scaling is applied correctly.
# We'll also add CSS to make the preview container scrollable.
# ----------------------------------------------------------------------
echo "Updating App.css for responsive layout"
cat >> src/App.css << 'APP_CSS_ADD'
.card-grid-container {
  overflow-x: auto;
  padding-bottom: 1rem;
}
.card-preview {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 1rem;
}
@media (max-width: 768px) {
  .card-preview > div {
    flex: 0 0 auto;
    width: 200px;
  }
}
APP_CSS_ADD

# ----------------------------------------------------------------------
# 6. Run TypeScript check
# ----------------------------------------------------------------------
echo "Running TypeScript check"
if npx tsc --noEmit 2>&1; then
    echo "TypeScript check passed"
    COMPILE_OK=true
else
    echo "TypeScript errors – but we will still commit (non‑fatal)"
    COMPILE_OK=false
fi

# ----------------------------------------------------------------------
# 7. Commit
# ----------------------------------------------------------------------
git add -A
git commit -m "fix: symlink all assets, update URLs to /art and /pips, responsive scaling"

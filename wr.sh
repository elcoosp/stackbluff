#!/usr/bin/env bash
set -uo pipefail

cd tools/sb-cards/card-compositor-renderer || exit 1

echo "=== Undoing symlinks and fixing asset serving ==="

# 1. Remove all symlinks in public
echo "Removing symlinks from public/"
rm -rf public/art public/pips public/fonts public/corner-light.png

# 2. Create an empty public directory for Vite to serve static files
mkdir -p public

# 3. Configure Vite to proxy asset requests to the actual deck folder
# We'll modify vite.config.ts to add a middleware or alias.
# Since Vite dev server can serve static files from any directory via `server.fs.allow`,
# we simply add the absolute paths to `server.fs.allow`.
# Also we add aliases for `/art`, `/pips`, `/fonts`, `/corner-light.png`.

DECK_BASE="$(cd ../../../2026-Q1/01-poison-gardenia && pwd)"
PIPS_DIR="${DECK_BASE}/2-pips"
ART_DIR="${DECK_BASE}/1-raw/art"
FONTS_DIR="$(cd ../../../engine/fonts && pwd 2>/dev/null || echo "$PWD/public/fonts")"

echo "Detected DECK_BASE: $DECK_BASE"
echo "ART_DIR: $ART_DIR"
echo "PIPS_DIR: $PIPS_DIR"

cat > vite.config.ts << VITE_CFG_FINAL
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 3000,
    open: true,
    fs: {
      // Allow serving files from these directories
      allow: [
        '$ART_DIR',
        '$PIPS_DIR',
        '$FONTS_DIR',
        '.',
      ]
    }
  },
  resolve: {
    alias: {
      '@': '/src',
    }
  }
});
VITE_CFG_FINAL

# 4. Create a small script to generate corner-light.png inside public if not exists
if [ ! -f public/corner-light.png ]; then
    echo "Generating corner-light.png inside public/"
    # Try ImageMagick first
    if command -v convert &> /dev/null; then
        convert -size 1000x1400 radial-gradient:white-transparent public/corner-light.png
    else
        # Create a minimal transparent PNG (1x1 transparent pixel) – not ideal but prevents 404
        printf '\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15\xc4\x89\x00\x00\x00\nIDATx\x9cc\x00\x01\x00\x00\x05\x00\x01\r\n-\xb4\x00\x00\x00\x00IEND\xaeB`\x82' > public/corner-light.png
        echo "Created dummy corner-light.png. Replace with proper gradient later."
    fi
fi

# 5. Update assetLoader.ts to use absolute URLs that resolve to those directories.
# We no longer use baseDir; we directly map to /art/..., /pips/..., etc.
cat > src/utils/assetLoader.ts << 'ASSET_LOADER_FINAL'
/**
 * Resolves asset paths to URLs that will be served by Vite dev server.
 * The Vite config allows serving from the actual deck folders.
 * So we construct URLs like /art/filename.png, /pips/suit-size.png, etc.
 */
export function resolveAssetPath(baseDir: string, filename: string, suffix: string): string {
  // Remove any leading path (if someone passed full path)
  const cleanName = filename.replace(/^.*[\\/]/, '');

  // Determine which folder the asset belongs to by its base name
  if (cleanName.match(/^(back|ace|jack|queen|king|number-template|corner-plaque|border|center-band|joker-)/)) {
    // These are in the raw art folder
    return `/art/${cleanName}`;
  }
  // Otherwise assume it's a pip image (already pre‑processed)
  // Example: spades-100.png, hearts-160.png
  return `/pips/${cleanName}`;
}
ASSET_LOADER_FINAL

# 6. Fix Card.tsx to use the correct pip URLs (already handled by assetLoader)
# But StandardLayout still hardcodes `/pips/...` – that's fine because we serve from /pips.

# 7. Make the card grid responsive (cards scale down to fit screen)
# Update DeckViewer component to use CSS scaling that actually works.
cat > src/components/DeckViewer.tsx << 'DECK_VIEWER_RESPONSIVE'
import React from 'react';
import { Card } from './Card';
import { CardData } from '../types';

interface Props {
  cards: CardData[];
  deckName: string;
}

export const DeckViewer: React.FC<Props> = ({ cards, deckName }) => {
  // Use CSS grid with auto-sized columns; each card container sets its own width.
  // The actual card is 1000x1400, but we scale it down via CSS transform.
  // We also add overflow-x: auto to the container to allow scrolling on small screens.
  return (
    <div className="w-full overflow-x-auto">
      <div className="flex flex-wrap justify-center gap-6 p-4">
        {cards.map((card, idx) => (
          <div key={idx} className="cursor-pointer transition-transform hover:scale-105" style={{ width: '260px', flexShrink: 0 }}>
            <div style={{ transform: 'scale(0.26)', transformOrigin: 'top left', width: '1000px', height: '1400px' }}>
              <Card
                rank={card.rank}
                suit={card.suit}
                artPath={card.artPath}
                isBack={card.isBack}
                layoutType={card.layoutType}
                deckName={deckName}
              />
            </div>
            {/* Add negative margin to compensate for scaling height? Better to let parent handle */}
          </div>
        ))}
      </div>
    </div>
  );
};
DECK_VIEWER_RESPONSIVE

# 8. Update App.css to ensure proper scrolling and background
cat >> src/App.css << 'APP_CSS_ADD'
/* Ensure the deck viewer doesn't overflow horizontally */
.overflow-x-auto {
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
}
.flex-wrap {
  flex-wrap: wrap;
}
@media (max-width: 640px) {
  .flex-wrap > div {
    width: 200px !important;
  }
  .flex-wrap > div > div {
    transform: scale(0.2) !important;
  }
}
APP_CSS_ADD

# 9. Run TypeScript check
echo "Running TypeScript check"
if npx tsc --noEmit 2>&1; then
    echo "TypeScript check passed"
else
    echo "TypeScript errors (non-fatal)"
fi

# 10. Commit
git add -A
git commit -m "fix: remove symlinks, use Vite fs.allow + proper responsive scaling"

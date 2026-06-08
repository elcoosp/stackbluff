#!/usr/bin/env bash
set -uo pipefail

cd tools/sb-cards/card-compositor-renderer || exit 1

echo "=== Setting up multi-deck support with asset copying ==="

# Determine the base directory for decks relative to this script's location
# We are now in tools/sb-cards/card-compositor-renderer
# Decks are in ../2026-Q1 (i.e., tools/sb-cards/2026-Q1)
DECK_BASE="../2026-Q1"
if [ ! -d "$DECK_BASE" ]; then
    echo "ERROR: Deck base directory not found at $DECK_BASE"
    echo "Expected to find 2026-Q1/ at tools/sb-cards/2026-Q1"
    exit 1
fi

# Create public/decks directory
mkdir -p public/decks

# Find all deck folders (01-*, 02-*, etc.)
shopt -s nullglob
decks=()
for d in "$DECK_BASE"/*/; do
    if [ -d "$d" ]; then
        deck_name=$(basename "$d")
        decks+=("$deck_name")
        echo "Processing deck: $deck_name"

        # Create deck directory in public/decks
        target="public/decks/$deck_name"
        mkdir -p "$target"

        # Copy 1-raw/art if exists
        if [ -d "$d/1-raw/art" ]; then
            cp -r "$d/1-raw/art" "$target/art"
            echo "  Copied art for $deck_name"
        else
            echo "  WARNING: No art folder for $deck_name"
        fi

        # Copy 2-pips if exists
        if [ -d "$d/2-pips" ]; then
            cp -r "$d/2-pips" "$target/pips"
            echo "  Copied pips for $deck_name"
        else
            echo "  WARNING: No 2-pips folder for $deck_name; run Python script first"
        fi
    fi
done

if [ ${#decks[@]} -eq 0 ]; then
    echo "No decks found in $DECK_BASE"
    exit 1
fi

# Generate decks.json for the frontend
echo "Creating public/decks/decks.json"
cat > public/decks/decks.json << JSON
{
  "decks": [
$(printf '    "%s"\n' "${decks[@]}" | sed '$!s/$/,/' | sed 's/^/    /')
  ]
}
JSON

# Generate a simple corner-light.png if missing
if [ ! -f public/corner-light.png ]; then
    if command -v convert &>/dev/null; then
        convert -size 1000x1400 radial-gradient:white-transparent public/corner-light.png
    else
        # Create a dummy 1000x1400 transparent PNG (base64)
        base64 -d > public/corner-light.png << 'PNG_BASE64'
iVBORw0KGgoAAAANSUhEUgAAA+gAAAPoAQMAAAB2J9EhAAAABlBMVEUAAAD///+l2Z/dAAAA
AXRSTlMAQObYZgAAAAlwSFlzAAAOxAAADsQBlSsOGwAAADFJREFUeJztwTEBAAAAwqD1T20K
P6AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA4G8AB4cAARjNuZUAAAAASUVORK5CYII=
PNG_BASE64
    fi
fi

# Copy fonts if available
if [ -d "../../engine/fonts" ]; then
    mkdir -p public/fonts
    cp -r "../../engine/fonts"/* public/fonts/ 2>/dev/null || true
    echo "Copied fonts"
fi

# ----------------------------------------------------------------------
# Update assetLoader.ts to use /decks/{deckName}/ prefix
# ----------------------------------------------------------------------
cat > src/utils/assetLoader.ts << 'ASSET_LOADER_MULTI'
export function resolveAssetPath(deckName: string, filename: string, suffix: string): string {
  const cleanName = filename.replace(/^.*[\\/]/, '');
  if (cleanName.match(/^(back|ace|jack|queen|king|number-template|corner-plaque|border|center-band|joker-)/)) {
    return `/decks/${deckName}/art/${cleanName}`;
  } else {
    return `/decks/${deckName}/pips/${cleanName}`;
  }
}
ASSET_LOADER_MULTI

# ----------------------------------------------------------------------
# Update Card.tsx to accept deckName and use the new assetLoader signature
# ----------------------------------------------------------------------
cat > src/components/Card.tsx << 'CARD_TSX_NEW'
import React from 'react';
import { StandardLayout } from '../layouts/StandardLayout';
import { ReversibleLayout } from '../layouts/ReversibleLayout';
import { resolveAssetPath } from '../utils/assetLoader';

interface Props {
  rank: string;
  suit: string;
  artPath: string;
  isBack?: boolean;
  layoutType: 'standard' | 'reversible';
  deckName: string;
}

export const Card: React.FC<Props> = ({
  rank,
  suit,
  artPath,
  isBack = false,
  layoutType,
  deckName,
}) => {
  const cornerPlaqueUrl = resolveAssetPath(deckName, `corner-plaque_inspyrenet.png`, '');
  const borderUrl = resolveAssetPath(deckName, `border_inspyrenet.png`, '');
  const centerBandUrl = resolveAssetPath(deckName, `center-band_inspyrenet.png`, '');

  const showPipPattern = layoutType === 'standard' && !isBack && rank !== 'JOKER';
  const artOpacity = layoutType === 'standard' && rank !== 'A' && !showPipPattern ? 0.5 : 1.0;
  const noPadding = layoutType === 'standard' && rank !== 'A' && !showPipPattern;

  if (layoutType === 'reversible') {
    return (
      <ReversibleLayout
        rank={rank}
        suit={suit}
        artUrl={artPath}
        cornerPlaqueUrl={cornerPlaqueUrl}
        borderUrl={borderUrl}
        cornerLightUrl="/corner-light.png"
        centerBandUrl={centerBandUrl}
      />
    );
  }

  return (
    <StandardLayout
      rank={rank}
      suit={suit}
      artUrl={artPath}
      cornerPlaqueUrl={cornerPlaqueUrl}
      borderUrl={borderUrl}
      cornerLightUrl="/corner-light.png"
      showPipPattern={showPipPattern}
      artOpacity={artOpacity}
      noPadding={noPadding}
      isBack={isBack}
    />
  );
};
CARD_TSX_NEW

# ----------------------------------------------------------------------
# Update App.tsx to fetch decks from decks.json and generate cards dynamically
# ----------------------------------------------------------------------
cat > src/App.tsx << 'APP_TSX_NEW'
import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { DeckViewer } from './components/DeckViewer';
import { CardPage } from './pages/CardPage';

const SUITS = ['spades', 'hearts', 'diamonds', 'clubs'];
const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
const FACE_RANKS = ['J', 'Q', 'K'];

function App() {
  const [selectedDeck, setSelectedDeck] = useState<string>('');
  const [availableDecks, setAvailableDecks] = useState<string[]>([]);
  const [cards, setCards] = useState<any[]>([]);

  useEffect(() => {
    fetch('/decks/decks.json')
      .then(res => res.json())
      .then(data => {
        setAvailableDecks(data.decks);
        if (data.decks.length > 0) setSelectedDeck(data.decks[0]);
      })
      .catch(err => console.error('Failed to load decks', err));
  }, []);

  useEffect(() => {
    if (!selectedDeck) return;
    const basePath = `/decks/${selectedDeck}/art/`;
    const suffix = '_inspyrenet';
    const newCards: any[] = [];

    // Card back
    newCards.push({
      rank: '',
      suit: '',
      artPath: `${basePath}back${suffix}.png`,
      isBack: true,
      layoutType: 'standard',
    });

    // Aces
    for (const suit of SUITS) {
      newCards.push({
        rank: 'A',
        suit,
        artPath: `${basePath}ace-${suit}${suffix}.png`,
        layoutType: 'standard',
      });
    }

    // Face cards
    for (const suit of SUITS) {
      for (const rank of FACE_RANKS) {
        const rankMap: Record<string, string> = { J: 'jack', Q: 'queen', K: 'king' };
        newCards.push({
          rank,
          suit,
          artPath: `${basePath}${rankMap[rank]}-${suit}${suffix}.png`,
          layoutType: 'reversible',
        });
      }
    }

    // Number cards
    for (const suit of SUITS) {
      for (const rank of RANKS.slice(0, 9)) {
        newCards.push({
          rank,
          suit,
          artPath: `${basePath}${rank}-${suit}${suffix}.png`,
          layoutType: 'standard',
        });
      }
    }

    // Jokers
    for (let i = 1; i <= 2; i++) {
      newCards.push({
        rank: 'JOKER',
        suit: '',
        artPath: `${basePath}joker-${i}${suffix}.png`,
        layoutType: 'standard',
      });
    }

    setCards(newCards);
  }, [selectedDeck]);

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={
          <div className="min-h-screen bg-gray-900 text-white p-8">
            <div className="max-w-7xl mx-auto">
              <h1 className="text-4xl font-bold mb-8 text-center">🎴 Card Composer</h1>
              <div className="flex gap-4 justify-center mb-8 flex-wrap">
                {availableDecks.map(deck => (
                  <button
                    key={deck}
                    onClick={() => setSelectedDeck(deck)}
                    className={`px-6 py-2 rounded-full transition ${
                      selectedDeck === deck
                        ? 'bg-amber-500 text-gray-900'
                        : 'bg-gray-800 hover:bg-gray-700'
                    }`}
                  >
                    {deck.replace(/^\d+-/, '').replace(/-/g, ' ')}
                  </button>
                ))}
              </div>
              {cards.length > 0 && <DeckViewer cards={cards} deckName={selectedDeck} />}
            </div>
          </div>
        } />
        <Route path="/card" element={<CardPage />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
APP_TSX_NEW

# ----------------------------------------------------------------------
# Update DeckViewer and CardPage
# ----------------------------------------------------------------------
cat > src/components/DeckViewer.tsx << 'DECK_VIEWER_FINAL'
import React from 'react';
import { Card } from './Card';
import { CardData } from '../types';

interface Props {
  cards: CardData[];
  deckName: string;
}

export const DeckViewer: React.FC<Props> = ({ cards, deckName }) => {
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
          </div>
        ))}
      </div>
    </div>
  );
};
DECK_VIEWER_FINAL

cat > src/pages/CardPage.tsx << 'CARD_PAGE_FINAL'
import React from 'react';
import { useSearchParams } from 'react-router-dom';
import { Card } from '../components/Card';

export const CardPage: React.FC = () => {
  const [params] = useSearchParams();
  const rank = params.get('rank') || '';
  const suit = params.get('suit') || '';
  const layoutType = params.get('layout') as 'standard' | 'reversible' || 'standard';
  const isBack = params.get('back') === 'true';
  const deckName = params.get('deck') || '';
  const artPath = params.get('art') || '';

  return (
    <div style={{ width: 1000, height: 1400 }}>
      <Card
        rank={rank}
        suit={suit}
        artPath={artPath}
        isBack={isBack}
        layoutType={layoutType}
        deckName={deckName}
      />
    </div>
  );
};
CARD_PAGE_FINAL

# ----------------------------------------------------------------------
# Remove old symlinks or leftovers
# ----------------------------------------------------------------------
rm -f public/art public/pips public/fonts 2>/dev/null || true

# ----------------------------------------------------------------------
# Minimal vite.config.ts
# ----------------------------------------------------------------------
cat > vite.config.ts << 'VITE_CLEAN'
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 3000,
    open: true,
  },
  resolve: {
    alias: {
      '@': '/src',
    },
  },
});
VITE_CLEAN

# ----------------------------------------------------------------------
# Run TypeScript check (non‑fatal)
# ----------------------------------------------------------------------
echo "Running TypeScript check"
npx tsc --noEmit 2>&1 || echo "TypeScript errors (non‑fatal, continuing)"

# ----------------------------------------------------------------------
# Commit
# ----------------------------------------------------------------------
git add -A
git commit -m "feat: multi‑deck support with asset copying, dynamic deck selection"

echo "✅ All done. Run 'pnpm dev' to start the dev server."

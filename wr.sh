#!/usr/bin/env bash
set -uo pipefail

COMPILE_OK=true
INCOMPLETE=false

cd tools/sb-cards/card-compositor-renderer || exit 1

# Fix TypeScript error: remove unused React import
echo "Patching src/App.tsx: remove unused React import"
cat > src/App.tsx << 'APP_TSX_FIXED'
import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { DeckViewer } from './components/DeckViewer';
import { CardPage } from './pages/CardPage';
import { decks } from './utils/deckConfig';

const SUITS = ['spades', 'hearts', 'diamonds', 'clubs'];
const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
const FACE_RANKS = ['J', 'Q', 'K'];

function App() {
  const [selectedDeck, setSelectedDeck] = useState<string>('poison-gardenia');
  const [cards, setCards] = useState<any[]>([]);

  useEffect(() => {
    const deck = decks[selectedDeck];
    const baseDir = deck.baseDir;
    const suffix = deck.suffix;

    const newCards: any[] = [];

    // Card back
    newCards.push({
      rank: '',
      suit: '',
      artPath: `${baseDir}/1-raw/art/back${suffix}.png`,
      isBack: true,
      layoutType: 'standard',
    });

    // Aces
    for (const suit of SUITS) {
      newCards.push({
        rank: 'A',
        suit,
        artPath: `${baseDir}/1-raw/art/ace-${suit}${suffix}.png`,
        layoutType: 'standard',
      });
    }

    // Face cards (reversible)
    for (const suit of SUITS) {
      for (const rank of FACE_RANKS) {
        const rankMap: Record<string, string> = { J: 'jack', Q: 'queen', K: 'king' };
        const artPath = `${baseDir}/1-raw/art/${rankMap[rank]}-${suit}${suffix}.png`;
        newCards.push({
          rank,
          suit,
          artPath,
          layoutType: 'reversible',
        });
      }
    }

    // Number cards
    for (const suit of SUITS) {
      for (const rank of RANKS.slice(0, 9)) {
        const specificPath = `${baseDir}/1-raw/art/${rank}-${suit}${suffix}.png`;
        newCards.push({
          rank,
          suit,
          artPath: specificPath,
          layoutType: 'standard',
        });
      }
    }

    // Jokers
    for (let i = 1; i <= 2; i++) {
      newCards.push({
        rank: 'JOKER',
        suit: '',
        artPath: `${baseDir}/1-raw/art/joker-${i}${suffix}.png`,
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
              <div className="flex gap-4 justify-center mb-8">
                {Object.entries(decks).map(([id, deck]) => (
                  <button
                    key={id}
                    onClick={() => setSelectedDeck(id)}
                    className={`px-6 py-2 rounded-full transition ${
                      selectedDeck === id
                        ? 'bg-amber-500 text-gray-900'
                        : 'bg-gray-800 hover:bg-gray-700'
                    }`}
                  >
                    {deck.name}
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
APP_TSX_FIXED

# Fix remaining unused React imports in other components if present (quick check)
echo "Fixing unused React imports in other files"
# For Card.tsx – React is used (JSX), so keep it.
# For DeckViewer.tsx – React is used (JSX), keep.
# For layouts – React is used, keep.
# For CardPage.tsx – React is used (JSX), keep.
# For main.tsx – React is used, keep.

# Generate a fallback corner-light.png using Node.js canvas if available, else create a simple 1000x1400 transparent PNG via base64 (placeholder)
echo "Ensuring corner-light.png exists (fallback)"
if [ ! -f public/corner-light.png ]; then
    # Create a 1000x1400 transparent PNG with a white-to-transparent radial gradient using ImageMagick if installed, else simple white square
    if command -v convert &> /dev/null; then
        convert -size 1000x1400 radial-gradient:white-transparent public/corner-light.png
        echo "Generated corner-light.png using ImageMagick"
    else
        # Fallback: create a fully transparent PNG (no gradient, but prevents missing file errors)
        # Use Node.js if available to generate a blank PNG
        if command -v node &> /dev/null; then
            node -e "const fs=require('fs'); const PNG=require('pngjs').PNG; const png=new PNG({width:1000,height:1400}); png.pack().pipe(fs.createWriteStream('public/corner-light.png'));" 2>/dev/null || echo "Node pngjs not installed"
        fi
        # If still missing, just create a white image using ImageMagick fallback
        if [ ! -f public/corner-light.png ]; then
            # Create a dummy white PNG (lossy but prevents 404)
            convert -size 1000x1400 xc:white public/corner-light.png 2>/dev/null || echo "Could not generate corner-light.png"
        fi
    fi
fi

# Re-run TypeScript check
echo "Running TypeScript check again"
if npx tsc --noEmit 2>&1; then
    echo "TypeScript check passed"
    COMPILE_OK=true
else
    echo "TypeScript still has errors"
    COMPILE_OK=false
fi

# Commit if successful
if [ "$INCOMPLETE" = true ] || [ "$COMPILE_OK" = false ]; then
    echo "Skipping commit due to TypeScript errors"
    exit 1
fi

git add -A
git commit -m "fix: remove unused React import, add corner-light fallback"

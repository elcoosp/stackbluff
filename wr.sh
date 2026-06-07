#!/usr/bin/env bash
set -uo pipefail

COMPILE_OK=true
INCOMPLETE=false

TARGET_DIR="tools/sb-cards/card-compositor-renderer"
echo "Creating target directory $TARGET_DIR"
mkdir -p "$TARGET_DIR"
cd "$TARGET_DIR" || { echo "ERROR: cannot cd into $TARGET_DIR"; exit 1; }

# Create directories
echo "Creating directories"
mkdir -p src/components src/layouts src/utils scripts public

# Write .gitignore
echo "Writing .gitignore"
cat > .gitignore << 'GITIGNORE_EOF'
node_modules/
dist/
.DS_Store
*.log
.env
*.swp
*.swo
*~
GITIGNORE_EOF

# Write package.json
echo "Writing package.json"
cat > package.json << 'PKG_EOF'
{
  "name": "card-compositor-renderer",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview",
    "export": "node scripts/export.js"
  },
  "dependencies": {
    "react": "^19.2.6",
    "react-dom": "^19.2.6",
    "react-router-dom": "^7.6.2"
  },
  "devDependencies": {
    "@tailwindcss/vite": "^4.3.0",
    "@types/node": "^20.11.30",
    "@types/react": "^19.2.6",
    "@types/react-dom": "^19.2.6",
    "@vitejs/plugin-react": "^4.2.1",
    "puppeteer": "^24.39.1",
    "tailwindcss": "^4.3.0",
    "typescript": "^6.0.3",
    "vite": "^8.0.0"
  }
}
PKG_EOF

# Write vite.config.ts
echo "Writing vite.config.ts"
cat > vite.config.ts << 'VITE_CFG_EOF'
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
VITE_CFG_EOF

# Write tsconfig.json
echo "Writing tsconfig.json"
cat > tsconfig.json << 'TS_CFG_EOF'
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"]
    }
  },
  "include": ["src"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
TS_CFG_EOF

# Write tsconfig.node.json
echo "Writing tsconfig.node.json"
cat > tsconfig.node.json << 'TS_NODE_EOF'
{
  "compilerOptions": {
    "composite": true,
    "skipLibCheck": true,
    "module": "ESNext",
    "moduleResolution": "bundler",
    "allowSyntheticDefaultImports": true,
    "strict": true
  },
  "include": ["vite.config.ts"]
}
TS_NODE_EOF

# Write index.html
echo "Writing index.html"
cat > index.html << 'HTML_EOF'
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Card Composer</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
HTML_EOF

# Write src/index.css
echo "Writing src/index.css"
cat > src/index.css << 'CSS_EOF'
@import "tailwindcss";

@theme {
  --color-hearts: #B82B4B;
  --color-spades: #1C1B1E;
  --color-clubs: #1C1B1E;
  --color-diamonds: #B82B4B;
}
CSS_EOF

# Write src/App.css
echo "Writing src/App.css"
cat > src/App.css << 'APP_CSS_EOF'
* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}
body {
  background: #2a2a2a;
  font-family: system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
  padding: 2rem;
}
.app {
  display: flex;
  flex-direction: column;
  gap: 2rem;
  align-items: center;
}
.deck-selector {
  display: flex;
  gap: 1rem;
  flex-wrap: wrap;
  justify-content: center;
}
.deck-button {
  background: #444;
  color: white;
  border: none;
  padding: 0.5rem 1.2rem;
  border-radius: 2rem;
  cursor: pointer;
  font-weight: 500;
  transition: all 0.2s;
}
.deck-button.active {
  background: #f0b27a;
  color: #1e1e1e;
  box-shadow: 0 0 0 2px white;
}
.card-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 260px));
  gap: 2rem;
  justify-content: center;
  width: 100%;
  max-width: 1400px;
  margin-top: 1rem;
}
.card-item {
  cursor: pointer;
  transition: transform 0.1s ease;
}
.card-item:hover {
  transform: scale(1.02);
}
APP_CSS_EOF

# Write src/types.ts
echo "Writing src/types.ts"
cat > src/types.ts << 'TYPES_EOF'
export interface CardData {
  rank: string;
  suit: string;
  artPath: string;
  isBack?: boolean;
  layoutType: 'standard' | 'reversible';
}

export interface DeckConfig {
  name: string;
  baseDir: string;
  suffix: string;
  cornerPlaquePath?: string;
  borderPath?: string;
  centerBandPath?: string;
  numberTemplatePath?: string;
  customNumberArtPaths?: Record<string, string>;
}

export type PipPosition = { col: 0 | 1 | 2; row: 0 | 1 | 2 | 3 | 4 };
export type PipLayouts = Record<string, PipPosition[]>;
TYPES_EOF

# Write src/utils/pipGrid.ts
echo "Writing src/utils/pipGrid.ts"
cat > src/utils/pipGrid.ts << 'PIP_GRID_EOF'
export const PIP_GRID_COLS = [250, 500, 750];
export const PIP_GRID_ROWS = [300, 500, 700, 900, 1100];

export const pipLayouts: Record<string, [number, number][]> = {
  "2": [[1,0], [1,4]],
  "3": [[1,0], [1,2], [1,4]],
  "4": [[0,0], [2,0], [0,4], [2,4]],
  "5": [[0,0], [2,0], [1,2], [0,4], [2,4]],
  "6": [[0,0], [2,0], [0,2], [2,2], [0,4], [2,4]],
  "7": [[0,0], [2,0], [1,1], [0,2], [2,2], [0,4], [2,4]],
  "8": [[0,0], [2,0], [1,1], [0,2], [2,2], [1,3], [0,4], [2,4]],
  "9": [[0,0], [2,0], [0,1], [2,1], [1,2], [0,3], [2,3], [0,4], [2,4]],
  "10": [[0,0], [2,0], [1,1], [0,1], [2,1], [0,3], [2,3], [1,3], [0,4], [2,4]],
};
PIP_GRID_EOF

# Write src/utils/assetLoader.ts
echo "Writing src/utils/assetLoader.ts"
cat > src/utils/assetLoader.ts << 'ASSET_LOADER_EOF'
export function resolveAssetPath(baseDir: string, filename: string, suffix: string): string {
  const candidates = [
    `${baseDir}/1-raw/art/${filename}`,
    `${baseDir}/1-raw/art/all_background_removal_results/${filename}`,
    `${baseDir}/1-raw/art/${filename.replace(suffix, '')}`,
    `${baseDir}/1-raw/art/all_background_removal_results/${filename.replace(suffix, '')}`,
  ];
  return candidates[0];
}
ASSET_LOADER_EOF

# Write src/utils/deckConfig.ts
echo "Writing src/utils/deckConfig.ts"
cat > src/utils/deckConfig.ts << 'DECK_CFG_EOF'
import { DeckConfig } from '../types';

export const decks: Record<string, DeckConfig> = {
  "poison-gardenia": {
    name: "Poison Gardenia",
    baseDir: "../2026-Q1/01-poison-gardenia",
    suffix: "_inspyrenet",
    cornerPlaquePath: "corner-plaque",
    borderPath: "border",
    centerBandPath: "center-band",
    numberTemplatePath: "number-template",
  },
};
DECK_CFG_EOF

# Write src/layouts/StandardLayout.tsx
echo "Writing src/layouts/StandardLayout.tsx"
cat > src/layouts/StandardLayout.tsx << 'STANDARD_LAYOUT_EOF'
import React from 'react';
import { PIP_GRID_COLS, PIP_GRID_ROWS, pipLayouts } from '../utils/pipGrid';

interface Props {
  rank: string;
  suit: string;
  artUrl: string;
  cornerPlaqueUrl?: string;
  borderUrl?: string;
  cornerLightUrl?: string;
  showPipPattern: boolean;
  artOpacity: number;
  noPadding: boolean;
  isBack: boolean;
}

export const StandardLayout: React.FC<Props> = ({
  rank,
  suit,
  artUrl,
  cornerPlaqueUrl,
  borderUrl,
  cornerLightUrl,
  showPipPattern,
  artOpacity,
  noPadding,
  isBack,
}) => {
  const suitColor = suit === 'hearts' || suit === 'diamonds' ? '#B82B4B' : '#1C1B1E';
  const pipPositions = showPipPattern && pipLayouts[rank] ? pipLayouts[rank] : [];

  return (
    <div className="relative w-[1000px] h-[1400px] bg-white shadow-2xl">
      {borderUrl && <img src={borderUrl} className="absolute inset-0 w-full h-full pointer-events-none" alt="border" />}
      <div
        className="absolute flex items-center justify-center pointer-events-none"
        style={{
          top: noPadding || isBack ? 0 : 200,
          left: noPadding || isBack ? 0 : 50,
          width: noPadding || isBack ? 1000 : 900,
          height: noPadding || isBack ? 1400 : 1000,
          opacity: artOpacity,
        }}
      >
        <img src={artUrl} className="max-w-full max-h-full object-contain" alt="art" />
      </div>
      {pipPositions.map(([col, row], idx) => {
        const left = PIP_GRID_COLS[col] - 80;
        const top = PIP_GRID_ROWS[row] - 80;
        return (
          <img
            key={idx}
            src={`/2-pips/${suit}-160.png`}
            className="absolute w-[160px] h-[160px] pointer-events-none"
            style={{ left, top }}
            alt="pip"
          />
        );
      })}
      {cornerLightUrl && !isBack && (
        <img src={cornerLightUrl} className="absolute inset-0 w-full h-full pointer-events-none mix-blend-multiply" alt="corner light" />
      )}
      <div className="absolute top-[35px] left-[35px]">
        {cornerPlaqueUrl ? (
          <div className="flex flex-col items-center">
            <img src={cornerPlaqueUrl} className="w-[160px] h-[160px]" alt="plaque" />
            <div className="text-[120px] font-bold text-center leading-none mt-[-120px]" style={{ color: suitColor, textShadow: '2px 2px white' }}>
              {rank}
            </div>
            {suit && <img src={`/2-pips/${suit}-90.png`} className="w-[90px] h-[90px] mt-2" alt="suit" />}
          </div>
        ) : (
          <div className="flex flex-col items-center">
            <div className="text-[120px] font-bold leading-none" style={{ color: suitColor }}>
              {rank}
            </div>
            {suit && <img src={`/2-pips/${suit}-100.png`} className="w-[100px] h-[100px]" alt="suit" />}
          </div>
        )}
      </div>
      <div className="absolute bottom-[35px] right-[35px] rotate-180">
        {cornerPlaqueUrl ? (
          <div className="flex flex-col items-center">
            <img src={cornerPlaqueUrl} className="w-[160px] h-[160px]" alt="plaque" />
            <div className="text-[120px] font-bold text-center leading-none mt-[-120px]" style={{ color: suitColor, textShadow: '2px 2px white' }}>
              {rank}
            </div>
            {suit && <img src={`/2-pips/${suit}-90.png`} className="w-[90px] h-[90px] mt-2" alt="suit" />}
          </div>
        ) : (
          <div className="flex flex-col items-center">
            <div className="text-[120px] font-bold leading-none" style={{ color: suitColor }}>
              {rank}
            </div>
            {suit && <img src={`/2-pips/${suit}-100.png`} className="w-[100px] h-[100px]" alt="suit" />}
          </div>
        )}
      </div>
    </div>
  );
};
STANDARD_LAYOUT_EOF

# Write src/layouts/ReversibleLayout.tsx
echo "Writing src/layouts/ReversibleLayout.tsx"
cat > src/layouts/ReversibleLayout.tsx << 'REV_LAYOUT_EOF'
import React from 'react';

interface Props {
  rank: string;
  suit: string;
  artUrl: string;
  cornerPlaqueUrl?: string;
  borderUrl?: string;
  cornerLightUrl?: string;
  centerBandUrl?: string;
}

export const ReversibleLayout: React.FC<Props> = ({
  rank,
  suit,
  artUrl,
  cornerPlaqueUrl,
  borderUrl,
  cornerLightUrl,
  centerBandUrl,
}) => {
  const suitColor = suit === 'hearts' || suit === 'diamonds' ? '#B82B4B' : '#1C1B1E';

  return (
    <div className="relative w-[1000px] h-[1400px] bg-white shadow-2xl">
      {borderUrl && <img src={borderUrl} className="absolute inset-0 w-full h-full pointer-events-none" alt="border" />}
      <div className="absolute top-[calc(50%-330px)] left-[50%] translate-x-[-50%] w-[900px] h-[640px] flex items-center justify-center pointer-events-none">
        <img src={artUrl} className="max-w-full max-h-full object-contain" alt="art" />
      </div>
      <div className="absolute bottom-[calc(50%-330px)] left-[50%] translate-x-[-50%] w-[900px] h-[640px] flex items-center justify-center pointer-events-none rotate-180">
        <img src={artUrl} className="max-w-full max-h-full object-contain" alt="art rotated" />
      </div>
      {centerBandUrl && <img src={centerBandUrl} className="absolute top-1/2 left-0 w-full -translate-y-1/2 pointer-events-none" alt="center band" />}
      {cornerLightUrl && <img src={cornerLightUrl} className="absolute inset-0 w-full h-full pointer-events-none mix-blend-multiply" alt="corner light" />}
      <div className="absolute top-[35px] left-[35px]">
        {cornerPlaqueUrl ? (
          <div className="flex flex-col items-center">
            <img src={cornerPlaqueUrl} className="w-[160px] h-[160px]" alt="plaque" />
            <div className="text-[120px] font-bold text-center leading-none mt-[-120px]" style={{ color: suitColor, textShadow: '2px 2px white' }}>
              {rank}
            </div>
            <img src={`/2-pips/${suit}-90.png`} className="w-[90px] h-[90px] mt-2" alt="suit" />
          </div>
        ) : (
          <div className="flex flex-col items-center">
            <div className="text-[120px] font-bold leading-none" style={{ color: suitColor }}>
              {rank}
            </div>
            <img src={`/2-pips/${suit}-100.png`} className="w-[100px] h-[100px]" alt="suit" />
          </div>
        )}
      </div>
      <div className="absolute bottom-[35px] right-[35px] rotate-180">
        {cornerPlaqueUrl ? (
          <div className="flex flex-col items-center">
            <img src={cornerPlaqueUrl} className="w-[160px] h-[160px]" alt="plaque" />
            <div className="text-[120px] font-bold text-center leading-none mt-[-120px]" style={{ color: suitColor, textShadow: '2px 2px white' }}>
              {rank}
            </div>
            <img src={`/2-pips/${suit}-90.png`} className="w-[90px] h-[90px] mt-2" alt="suit" />
          </div>
        ) : (
          <div className="flex flex-col items-center">
            <div className="text-[120px] font-bold leading-none" style={{ color: suitColor }}>
              {rank}
            </div>
            <img src={`/2-pips/${suit}-100.png`} className="w-[100px] h-[100px]" alt="suit" />
          </div>
        )}
      </div>
    </div>
  );
};
REV_LAYOUT_EOF

# Write src/components/Card.tsx
echo "Writing src/components/Card.tsx"
cat > src/components/Card.tsx << 'CARD_COMP_EOF'
import React from 'react';
import { CardData } from '../types';
import { StandardLayout } from '../layouts/StandardLayout';
import { ReversibleLayout } from '../layouts/ReversibleLayout';
import { resolveAssetPath } from '../utils/assetLoader';
import { decks } from '../utils/deckConfig';

interface Props extends CardData {
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
  const deck = decks[deckName];
  const suffix = deck.suffix;
  const baseDir = deck.baseDir;

  const cornerPlaqueUrl = deck.cornerPlaquePath
    ? resolveAssetPath(baseDir, `${deck.cornerPlaquePath}${suffix}.png`, suffix)
    : undefined;
  const borderUrl = deck.borderPath
    ? resolveAssetPath(baseDir, `${deck.borderPath}${suffix}.png`, suffix)
    : undefined;
  const centerBandUrl = deck.centerBandPath
    ? resolveAssetPath(baseDir, `${deck.centerBandPath}${suffix}.png`, suffix)
    : undefined;

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
CARD_COMP_EOF

# Write src/components/DeckViewer.tsx
echo "Writing src/components/DeckViewer.tsx"
cat > src/components/DeckViewer.tsx << 'DECK_VIEWER_EOF'
import React from 'react';
import { Card } from './Card';
import { CardData } from '../types';

interface Props {
  cards: CardData[];
  deckName: string;
}

export const DeckViewer: React.FC<Props> = ({ cards, deckName }) => {
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(250px,1fr))] gap-8 justify-items-center p-4">
      {cards.map((card, idx) => (
        <div key={idx} className="cursor-pointer transition-transform hover:scale-105">
          <Card
            rank={card.rank}
            suit={card.suit}
            artPath={card.artPath}
            isBack={card.isBack}
            layoutType={card.layoutType}
            deckName={deckName}
          />
        </div>
      ))}
    </div>
  );
};
DECK_VIEWER_EOF

# Write src/App.tsx
echo "Writing src/App.tsx"
cat > src/App.tsx << 'APP_TSX_EOF'
import React, { useState, useEffect } from 'react';
import { DeckViewer } from './components/DeckViewer';
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
  );
}

export default App;
APP_TSX_EOF

# Write src/main.tsx
echo "Writing src/main.tsx"
cat > src/main.tsx << 'MAIN_TSX_EOF'
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
MAIN_TSX_EOF

# Write scripts/export.js
echo "Writing scripts/export.js"
cat > scripts/export.js << 'EXPORT_JS_EOF'
import puppeteer from 'puppeteer';
import { decks } from '../src/utils/deckConfig.js';
import { resolveAssetPath } from '../src/utils/assetLoader.js';

const DECK_NAME = 'poison-gardenia';
const deck = decks[DECK_NAME];
const baseDir = deck.baseDir;
const suffix = deck.suffix;

const SUITS = ['spades', 'hearts', 'diamonds', 'clubs'];
const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
const FACE_RANKS = ['J', 'Q', 'K'];

async function exportCard(page, rank, suit, isBack, layoutType, outputFilename, customArtPath = null) {
  const url = `http://localhost:3000/card?rank=${rank}&suit=${suit}&layout=${layoutType}&back=${isBack}`;
  await page.goto(url);
  const element = await page.$('.card');
  if (element) {
    const outDir = `${deck.baseDir}/3-game-cards`;
    const klingDir = `${deck.baseDir}/1-raw/kling-input`;
    await element.screenshot({ path: `${outDir}/${outputFilename}` });
    await element.screenshot({ path: `${klingDir}/${outputFilename}` });
  }
}

async function exportDeck() {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  await page.setViewport({ width: 1000, height: 1400 });

  // Card back
  await exportCard(page, '', '', true, 'standard', 'back.png');

  // Aces
  for (const suit of SUITS) {
    await exportCard(page, 'A', suit, false, 'standard', `ace-${suit}.png`);
  }

  // Face cards
  for (const suit of SUITS) {
    for (const rank of FACE_RANKS) {
      const rankMap = { J: 'jack', Q: 'queen', K: 'king' };
      const filename = `${rankMap[rank]}-${suit}${suffix}.png`;
      const artPath = resolveAssetPath(baseDir, filename, suffix);
      await exportCard(page, rank, suit, false, 'reversible', `${rank.toLowerCase()}-${suit}.png`, artPath);
    }
  }

  // Number cards
  for (const suit of SUITS) {
    for (const rank of RANKS.slice(0, 9)) {
      await exportCard(page, rank, suit, false, 'standard', `${rank}-${suit}.png`);
    }
  }

  // Jokers
  for (let i = 1; i <= 2; i++) {
    const artPath = resolveAssetPath(baseDir, `joker-${i}${suffix}.png`, suffix);
    await exportCard(page, 'JOKER', '', false, 'standard', `joker-${i}.png`, artPath);
  }

  await browser.close();
}

exportDeck().catch(console.error);
EXPORT_JS_EOF

# No compilation or tests for now – just commit initial skeleton
echo "All files written. Committing initial skeleton."
git add -A
git commit -m "chore: initial project skeleton for card-compositor-renderer"

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

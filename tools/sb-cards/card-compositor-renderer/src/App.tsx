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
    const basePath = `/decks/${selectedDeck}/art/all_background_removal_results/`;
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

    // Aces (custom art always)
    for (const suit of SUITS) {
      newCards.push({
        rank: 'A',
        suit,
        artPath: `${basePath}ace-${suit}${suffix}.png`,
        layoutType: 'standard',
        hasCustomArt: true,
      });
    }

    // Face cards (reversible)
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

    // Number cards (2-10) – assume custom art exists; provide fallback
    const templatePath = `${basePath}number-template${suffix}.png`;
    for (const suit of SUITS) {
      for (const rank of RANKS.slice(0, 9)) {
        const specificPath = `${basePath}${rank}-${suit}${suffix}.png`;
        newCards.push({
          rank,
          suit,
          artPath: specificPath,
          fallbackArtPath: templatePath,
          layoutType: 'standard',
          hasCustomArt: true, // try custom first, fallback on error
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
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
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

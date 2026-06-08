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

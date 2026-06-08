import React from 'react';
import { Card } from './Card';
import { CardData } from '../types';

interface Props {
  cards: CardData[];
  deckName: string;
}

export const DeckViewer: React.FC<Props> = ({ cards, deckName }) => {
  const cardWidth = 260; // pixels for preview
  const scale = cardWidth / 1000; // 1000 is original card width
  const scaledHeight = 1400 * scale;

  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-8 justify-items-center p-4">
      {cards.map((card, idx) => (
        <div key={idx} className="cursor-pointer transition-transform hover:scale-105" style={{ width: cardWidth }}>
          <div
            style={{
              width: 1000,
              height: 1400,
              transform: `scale(${scale})`,
              transformOrigin: 'top left',
            }}
          >
            <Card
              rank={card.rank}
              suit={card.suit}
              artPath={card.artPath}
              isBack={card.isBack}
              layoutType={card.layoutType}
              deckName={deckName}
            />
          </div>
          <div style={{ height: scaledHeight - 1400 * scale }} /> {/* maintain spacing */}
        </div>
      ))}
    </div>
  );
};

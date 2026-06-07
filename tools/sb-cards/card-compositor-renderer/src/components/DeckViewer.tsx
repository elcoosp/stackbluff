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

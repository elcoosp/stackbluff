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
  const fallbackArtPath = params.get('fallback') || undefined;
  const hasCustomArt = params.get('custom') === 'true';

  return (
    <div style={{ width: 1000, height: 1400 }}>
      <Card
        rank={rank}
        suit={suit}
        artPath={artPath}
        fallbackArtPath={fallbackArtPath}
        isBack={isBack}
        layoutType={layoutType}
        deckName={deckName}
        hasCustomArt={hasCustomArt}
      />
    </div>
  );
};

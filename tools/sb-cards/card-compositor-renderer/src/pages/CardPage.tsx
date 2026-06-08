import React from 'react';
import { useSearchParams } from 'react-router-dom';
import { Card } from '../components/Card';
import { decks } from '../utils/deckConfig';
import { resolveAssetPath } from '../utils/assetLoader';

export const CardPage: React.FC = () => {
  const [params] = useSearchParams();
  const rank = params.get('rank') || '';
  const suit = params.get('suit') || '';
  const layoutType = params.get('layout') as 'standard' | 'reversible' || 'standard';
  const isBack = params.get('back') === 'true';
  const deckName = params.get('deck') || 'poison-gardenia';
  const deck = decks[deckName];
  const suffix = deck.suffix;

  let artPath = '';
  if (isBack) {
    artPath = resolveAssetPath(deck.baseDir, `back${suffix}.png`, suffix);
  } else if (rank === 'JOKER') {
    const idx = params.get('idx') || '1';
    artPath = resolveAssetPath(deck.baseDir, `joker-${idx}${suffix}.png`, suffix);
  } else if (rank === 'A') {
    artPath = resolveAssetPath(deck.baseDir, `ace-${suit}${suffix}.png`, suffix);
  } else if (['J','Q','K'].includes(rank)) {
    const rankMap: Record<string,string> = { J:'jack', Q:'queen', K:'king' };
    artPath = resolveAssetPath(deck.baseDir, `${rankMap[rank]}-${suit}${suffix}.png`, suffix);
  } else {
    const custom = resolveAssetPath(deck.baseDir, `${rank}-${suit}${suffix}.png`, suffix);
    artPath = custom;
  }

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

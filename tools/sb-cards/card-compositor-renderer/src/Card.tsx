import React from 'react';
import { StandardLayout } from './layouts/StandardLayout';
import { ReversibleLayout } from './layouts/ReversibleLayout';
import { resolveAssetPath } from './utils/assetLoader';

interface Props {
  rank: string;
  suit: string;
  artPath: string;          // should be the raw PNG filename without path, e.g. "2-clubs_inspyrenet.png"
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
  const cornerPlaqueUrl = resolveAssetPath(deckName, 'corner-plaque_inspyrenet.png', '');
  const borderUrl = resolveAssetPath(deckName, 'border_inspyrenet.png', '');
  const centerBandUrl = resolveAssetPath(deckName, 'center-band_inspyrenet.png', '');

  const showPipPattern = layoutType === 'standard' && !isBack && rank !== 'JOKER';
  const artOpacity = layoutType === 'standard' && rank !== 'A' && !showPipPattern ? 0.5 : 1.0;
  const noPadding = layoutType === 'standard' && rank !== 'A' && !showPipPattern;

  // Resolve raw art URL (the artPath is just filename, e.g. "2-clubs_inspyrenet.png")
  const fullArtUrl = resolveAssetPath(deckName, artPath, '');

  if (layoutType === 'reversible') {
    return (
      <ReversibleLayout
        rank={rank}
        suit={suit}
        artUrl={fullArtUrl}
        cornerPlaqueUrl={cornerPlaqueUrl}
        borderUrl={borderUrl}
        centerBandUrl={centerBandUrl}
      />
    );
  }

  return (
    <StandardLayout
      rank={rank}
      suit={suit}
      artUrl={fullArtUrl}
      cornerPlaqueUrl={cornerPlaqueUrl}
      borderUrl={borderUrl}
      showPipPattern={showPipPattern}
      artOpacity={artOpacity}
      noPadding={noPadding}
      isBack={isBack}
    />
  );
};

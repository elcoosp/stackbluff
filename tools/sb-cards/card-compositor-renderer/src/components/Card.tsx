import React from 'react';
import { StandardLayout } from '../layouts/StandardLayout';
import { ReversibleLayout } from '../layouts/ReversibleLayout';
import { resolveAssetPath } from '../utils/assetLoader';

interface Props {
  rank: string;
  suit: string;
  artPath: string;
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
  const cornerPlaqueUrl = resolveAssetPath(deckName, `corner-plaque_inspyrenet.png`, '');
  const borderUrl = resolveAssetPath(deckName, `border_inspyrenet.png`, '');
  const centerBandUrl = resolveAssetPath(deckName, `center-band_inspyrenet.png`, '');

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

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

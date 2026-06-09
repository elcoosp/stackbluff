import React, { useState, useEffect } from 'react';
import { StandardLayout } from '../layouts/StandardLayout';
import { ReversibleLayout } from '../layouts/ReversibleLayout';
import { resolveAssetPath } from '../utils/assetLoader';

interface Props {
  rank: string;
  suit: string;
  artPath: string;
  fallbackArtPath?: string;
  isBack?: boolean;
  layoutType: 'standard' | 'reversible';
  deckName: string;
  hasCustomArt?: boolean;
}

function rankToBaseName(rank: string): string {
  const lower = rank.toLowerCase();
  if (lower === 'j') return 'char-j';
  if (lower === 'q') return 'char-q';
  if (lower === 'k') return 'char-k';
  if (lower === 'a') return 'char-a';
  if (lower === '10') return 'num-10';
  return `num-${lower}`;
}

export const Card: React.FC<Props> = ({
  rank,
  suit,
  artPath,
  fallbackArtPath,
  isBack = false,
  layoutType,
  deckName,
  hasCustomArt = false,
}) => {
  const [currentArtPath, setCurrentArtPath] = useState(artPath);
  const [usingTemplate, setUsingTemplate] = useState(!hasCustomArt);
  const [imageError, setImageError] = useState(false);
  const [rankImageOk, setRankImageOk] = useState<Record<string, boolean>>({});

  const cornerPlaqueUrl = resolveAssetPath(deckName, `corner-plaque_inspyrenet.png`);
  const borderUrl = resolveAssetPath(deckName, `border_inspyrenet.png`);
  const centerBandUrl = resolveAssetPath(deckName, `center-band_inspyrenet.png`);
  const pipBaseUrl = `/decks/${deckName}/pips/`;
  const artBasePath = `/decks/${deckName}/art/all_background_removal_results/`;

  const isRed = suit === 'hearts' || suit === 'diamonds';
  const variant = isRed ? 'accent' : 'dark';
  const baseName = rankToBaseName(rank);
  const rankImageUrl = `${artBasePath}${baseName}_${variant}.png`;

  const handleImageError = () => {
    if (!imageError && fallbackArtPath && currentArtPath !== fallbackArtPath) {
      console.log(`Falling back to template for ${rank} of ${suit}`);
      setCurrentArtPath(fallbackArtPath);
      setUsingTemplate(true);
      setImageError(true);
    }
  };

  const handleRankImageError = () => {
    console.warn(`Rank image missing: ${rankImageUrl}, using text fallback`);
    setRankImageOk(prev => ({ ...prev, [variant]: false }));
  };

  const handleRankImageLoad = () => {
    setRankImageOk(prev => ({ ...prev, [variant]: true }));
  };

  let showPipPattern = false;
  let artOpacity = 1.0;
  let noPadding = false;

  if (layoutType === 'standard' && !isBack && rank !== 'JOKER') {
    if (usingTemplate) {
      showPipPattern = true;
      artOpacity = 0.5;
      noPadding = true;
    } else {
      showPipPattern = false;
      artOpacity = 1.0;
      noPadding = false;
    }
  }

  const layoutProps = {
    rank,
    suit,
    artUrl: currentArtPath,
    cornerPlaqueUrl,
    borderUrl,
    centerBandUrl,
    pipBaseUrl,
    onImageError: handleImageError,
    rankImageUrl,
    useRankImage: rankImageOk[variant] ?? true,
    onRankImageError: handleRankImageError,
    onRankImageLoad: handleRankImageLoad,
  };

  if (layoutType === 'reversible') {
    return <ReversibleLayout {...layoutProps} />;
  }
  return <StandardLayout {...layoutProps} showPipPattern={showPipPattern} artOpacity={artOpacity} noPadding={noPadding} isBack={isBack} />;
};

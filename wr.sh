#!/usr/bin/env bash
set -uo pipefail

cd tools/sb-cards/card-compositor-renderer || exit 1

echo "=== Force all assets to load from decks/*/art/all_background_removal_results ==="

# 1. Copy all required assets (border, corner‑plaque, etc.) into the subfolder for each deck
for deck in ../2026-Q1/*/; do
    deck_name=$(basename "$deck")
    target_sub="public/decks/$deck_name/art/all_background_removal_results"
    mkdir -p "$target_sub"
    src_art="$deck/1-raw/art"
    src_sub="$src_art/all_background_removal_results"

    # List of asset base names (without suffix)
    assets=("back" "border" "corner-plaque" "center-band" "number-template"
            "ace-spades" "ace-hearts" "ace-diamonds" "ace-clubs"
            "jack-spades" "jack-hearts" "jack-diamonds" "jack-clubs"
            "queen-spades" "queen-hearts" "queen-diamonds" "queen-clubs"
            "king-spades" "king-hearts" "king-diamonds" "king-clubs"
            "joker-1" "joker-2")

    for base in "${assets[@]}"; do
        filename="${base}_inspyrenet.png"
        # Prefer from src_sub first, then from src_art
        if [ -f "$src_sub/$filename" ]; then
            cp "$src_sub/$filename" "$target_sub/"
            echo "Copied $filename (from sub) for $deck_name"
        elif [ -f "$src_art/$filename" ]; then
            cp "$src_art/$filename" "$target_sub/"
            echo "Copied $filename (from root) for $deck_name"
        else
            echo "⚠️ Missing $filename for $deck_name"
        fi
    done
done

# 2. Update assetLoader.ts to always use all_background_removal_results (no fallback, no detection)
cat > src/utils/assetLoader.ts << 'ASSET_LOADER_FIXED'
export function resolveAssetPath(deckName: string, filename: string): string {
  // Always serve from the background-removal subfolder
  return `/decks/${deckName}/art/all_background_removal_results/${filename}`;
}
ASSET_LOADER_FIXED

# 3. Update Card.tsx: rank images still use the same base path but without _inspyrenet suffix
# The rank images should have been generated already and placed in the same subfolder without suffix.
# We'll also ensure that rank image URL is built correctly.
cat > src/components/Card.tsx << 'CARD_FINAL_ALL'
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
CARD_FINAL_ALL

# 4. StandardLayout and ReversibleLayout already use rankImageUrl and useRankImage props – no changes needed.

# 5. Restart dev server
echo "✅ All assets now served from all_background_removal_results, including rank images (without suffix)."
echo "Restart dev server: pnpm dev"
pkill -f "vite" || true
pnpm dev &

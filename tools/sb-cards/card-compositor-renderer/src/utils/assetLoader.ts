export function resolveAssetPath(deckName: string, filename: string): string {
  // Always serve from the background-removal subfolder
  return `/decks/${deckName}/art/all_background_removal_results/${filename}`;
}

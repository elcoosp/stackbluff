export function resolveAssetPath(
  _deckName: string,
  fileName: string,
  _subfolder: string
): string {
  // All overlay assets (border, plaque, band, raw art) come from all_background_removal_results
  // and have _inspyrenet.png suffix (or _birefnet.png)
  let fullPath = `/1-raw/art/all_background_removal_results/${fileName}`;

  // Debug log in browser console
  if (typeof window !== 'undefined') {
    console.log(`[assetLoader] Resolving: ${fileName} -> ${fullPath}`);
  }
  return fullPath;
}

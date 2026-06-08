/**
 * Resolves asset paths to URLs that will be served by Vite dev server.
 * The Vite config allows serving from the actual deck folders.
 * So we construct URLs like /art/filename.png, /pips/suit-size.png, etc.
 */
export function resolveAssetPath(baseDir: string, filename: string, suffix: string): string {
  // Remove any leading path (if someone passed full path)
  const cleanName = filename.replace(/^.*[\\/]/, '');

  // Determine which folder the asset belongs to by its base name
  if (cleanName.match(/^(back|ace|jack|queen|king|number-template|corner-plaque|border|center-band|joker-)/)) {
    // These are in the raw art folder
    return `/art/${cleanName}`;
  }
  // Otherwise assume it's a pip image (already pre‑processed)
  // Example: spades-100.png, hearts-160.png
  return `/pips/${cleanName}`;
}

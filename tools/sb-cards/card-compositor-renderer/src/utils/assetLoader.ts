/**
 * Resolves asset paths to URLs served from the public directory.
 * The actual files are symlinked in public/art/ and public/pips/
 */
export function resolveAssetPath(baseDir: string, filename: string, suffix: string): string {
  // Determine which folder the file belongs to
  // 2-pips images are already pre‑processed in the pips folder
  if (filename.includes('2-pips/') || filename.includes('pip-')) {
    // Extract suit and size from filename like "spades-100.png"
    const match = filename.match(/(spades|hearts|diamonds|clubs)-(\d+)\.png/);
    if (match) {
      return `/pips/${match[1]}-${match[2]}.png`;
    }
    // Fallback: treat as generic pips
    return `/pips/${filename.replace(/^.*\//, '')}`;
  }

  // All other assets (back, ace, jack, number-template, border, corner‑plaque, center‑band, joker)
  // are in the raw art folder.
  // The filename may already contain the suffix. We just use it as is.
  // Remove any leading path and use /art/
  const cleanName = filename.replace(/^.*[\\/]/, '');
  return `/art/${cleanName}`;
}

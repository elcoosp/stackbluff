export function resolveAssetPath(baseDir: string, filename: string, suffix: string): string {
  const candidates = [
    `${baseDir}/1-raw/art/${filename}`,
    `${baseDir}/1-raw/art/all_background_removal_results/${filename}`,
    `${baseDir}/1-raw/art/${filename.replace(suffix, '')}`,
    `${baseDir}/1-raw/art/all_background_removal_results/${filename.replace(suffix, '')}`,
  ];
  return candidates[0];
}

// utils/assetUrl.ts
export function getAssetUrl(path: string): string {
  // import.meta.env.BASE_URL is Vite's base path (e.g., '/', '/my-app/')
  // Ensure no double slashes
  const base = import.meta.env.BASE_URL;
  const normalizedPath = path.startsWith('/') ? path.slice(1) : path;
  return `${base}${normalizedPath}`;
}

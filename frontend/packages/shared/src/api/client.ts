import { getToken } from '../auth/token';
import { getPlatformSurface } from '../platform/surface';

export async function apiClient<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const surface = getPlatformSurface();
  const token = await getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  // Ensure endpoint starts with /api
  const path = endpoint.startsWith('/api')
    ? endpoint
    : `/api${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
  // Web default baseUrl is '' (relative, same-origin). Native hosts inject
  // their backend origin via configurePlatform().
  const url = `${surface.api.baseUrl}${path}`;
  const response = await fetch(url, {
    ...options,
    headers,
    credentials: 'include',
  });
  if (!response.ok) {
    const text = await response.text();
    try {
      const error = JSON.parse(text);
      throw new Error(error.error || error.message || response.statusText);
    } catch {
      throw new Error(`HTTP ${response.status}: ${text.slice(0, 100)}`);
    }
  }
  return response.json();
}

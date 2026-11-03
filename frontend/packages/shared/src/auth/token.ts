import { getPlatformSurface } from '../platform/surface';

/**
 * Auth token access — routed through the platform surface's TokenStorage
 * (web default: localStorage key 'auth_token'; native: injected storage).
 * Storage reads/writes are asynchronous on native, so these APIs are async
 * everywhere for a uniform call pattern.
 */
export async function getToken(): Promise<string | null> {
  return getPlatformSurface().tokenStorage.get();
}

export async function setToken(token: string): Promise<void> {
  await getPlatformSurface().tokenStorage.set(token);
}

export async function removeToken(): Promise<void> {
  await getPlatformSurface().tokenStorage.set(null);
}

export async function isAuthenticated(): Promise<boolean> {
  return !!(await getToken());
}

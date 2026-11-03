import AsyncStorage from '@react-native-async-storage/async-storage';
import { getPlatformSurface } from '@stackbluff/shared/src/platform/surface';
import * as Application from 'expo-application';
import Constants from 'expo-constants';
import * as Crypto from 'expo-crypto';
import { ensureNativePlatformConfigured } from './platform';

/**
 * Shared configuration + small helpers for the native services layer
 * (push, purchases, sentry).
 *
 * Networking is surface-aware: the auth token comes from the configured
 * `PlatformSurface.tokenStorage` (AsyncStorage, wired by platform.ts at
 * boot) and the base URL from `getApiBaseUrl()` — the same value the boot
 * wiring hands to `configurePlatform({ api: { baseUrl } })`, so shared
 * `apiClient` calls and this module's `authedFetch` always hit the same
 * backend. The direct-AsyncStorage fallback keeps the module working even
 * when the boot wiring has not run yet.
 */

/** AsyncStorage key for the JWT. Mirrors the PWA token key name. */
const AUTH_TOKEN_KEY = 'auth_token';
/** AsyncStorage key for the fallback per-install device id. */
const DEVICE_ID_KEY = 'stackbluff_device_id';

/**
 * Backend base URL.
 * 1. `EXPO_PUBLIC_API_URL` (recommended, inlined by Expo at build time)
 * 2. `app.json` → `expo.extra.apiBaseUrl`
 * 3. Production default.
 */
export function getApiBaseUrl(): string {
  const fromEnv = process.env.EXPO_PUBLIC_API_URL;
  if (fromEnv && fromEnv.trim().length > 0) return fromEnv.trim();
  const fromExtra = (Constants.expoConfig?.extra as { apiBaseUrl?: string } | undefined)
    ?.apiBaseUrl;
  if (fromExtra && fromExtra.trim().length > 0) return fromExtra.trim();
  return 'https://stackbluff.com';
}

export async function getAuthToken(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(AUTH_TOKEN_KEY);
  } catch {
    return null;
  }
}

export async function setAuthToken(token: string | null): Promise<void> {
  try {
    if (token === null) await AsyncStorage.removeItem(AUTH_TOKEN_KEY);
    else await AsyncStorage.setItem(AUTH_TOKEN_KEY, token);
  } catch {
    // Storage failures are non-fatal; auth flows will re-login.
  }
}

/**
 * `fetch` wrapper that attaches the JSON content type and the auth header
 * when a token is stored. Returns the raw `Response` so callers can decide
 * how to surface errors (mirrors the PWA push/shop helpers).
 *
 * Surface-aware: reads the token via the configured platform surface
 * (AsyncStorage once `configurePlatform` has run — `platform.ts`), falling
 * back to a direct AsyncStorage read when the boot wiring has not run, and
 * resolves the base URL the same way the shared `apiClient` does
 * (`getPlatformSurface().api.baseUrl`, which boot wiring sets to
 * `getApiBaseUrl()`).
 */
export async function authedFetch(path: string, init: RequestInit = {}): Promise<Response> {
  ensureNativePlatformConfigured();
  const surface = getPlatformSurface();
  const base = surface.api.baseUrl || getApiBaseUrl();
  const url = path.startsWith('http') ? path : `${base}${path.startsWith('/') ? path : `/${path}`}`;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(init.headers as Record<string, string> | undefined),
  };
  const token = (await surface.tokenStorage.get()) ?? (await getAuthToken());
  if (token) headers.Authorization = `Bearer ${token}`;
  return fetch(url, { ...init, headers });
}

/**
 * Stable per-device identifier used for push registration.
 *
 * NOTE: expo-application ~58 no longer exports `getInstallationIdAsync`;
 * the closest stable per-device ids are `getAndroidId()` (SSAID) and
 * `getIosIdForVendorAsync()` (IDFV). Neither exists on web, so we fall back
 * to a UUID persisted in AsyncStorage (stable per app install).
 */
export async function getDeviceIdAsync(): Promise<string> {
  try {
    if (Application.getAndroidId) {
      const androidId = Application.getAndroidId();
      if (androidId) return `android-${androidId}`;
    }
    if (Application.getIosIdForVendorAsync) {
      const idfv = await Application.getIosIdForVendorAsync();
      if (idfv) return `ios-${idfv}`;
    }
  } catch {
    // Fall through to the persisted-id strategy.
  }
  try {
    const stored = await AsyncStorage.getItem(DEVICE_ID_KEY);
    if (stored) return stored;
    const generated = Crypto.randomUUID();
    await AsyncStorage.setItem(DEVICE_ID_KEY, generated);
    return generated;
  } catch {
    // Last resort: ephemeral id for this session only.
    return `ephemeral-${Crypto.randomUUID()}`;
  }
}

/** EAS project id from app.json `extra.eas.projectId` (used by push tokens). */
export function getEasProjectId(): string | undefined {
  const extra = Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined;
  return extra?.eas?.projectId;
}

/** True when an EXPO_PUBLIC_* value is still an obvious placeholder. */
export function isPlaceholderValue(value: string | undefined): boolean {
  if (!value) return true;
  const v = value.trim();
  if (v.length === 0) return true;
  return (
    /^<.*>$/.test(v) ||
    /^(your|my|replace|change|insert|add)[_-]/i.test(v) ||
    /placeholder|example|changeme|xxx+/i.test(v)
  );
}

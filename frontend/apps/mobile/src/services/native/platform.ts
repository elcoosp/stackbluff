import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import type { UserUpdatedMessage } from '@stackbluff/shared/src/hooks/gameWebSocketBridge';
import { configureGameWebSocketBridge } from '@stackbluff/shared/src/hooks/gameWebSocketBridge';
import {
  type AudioBackend,
  configurePlatform,
  type HapticsBackend,
  type KVStorage,
  type OnNetworkChange,
  type TokenStorage,
} from '@stackbluff/shared/src/platform/surface';
import * as ExpoHaptics from 'expo-haptics';
import { Platform } from 'react-native';
import { useEntitlementsStore } from '../../lib/entitlements';
import { getApiBaseUrl } from './config';

/**
 * Native platform-surface boot (Agent-06 lane).
 *
 * Task 2-b's contract note: the mobile app MUST call
 * `configurePlatform({ platformId, tokenStorage, kvStorage, haptics, audio,
 * api: { baseUrl } })` once at boot, and `configureGameWebSocketBridge(...)`
 * with its host integrations, because `@stackbluff/shared` never imports
 * React Native itself. This module provides those implementations
 * (AsyncStorage token/KV, expo-haptics backend, native ws/api URLs) and is
 * safe to call from the root layout (A5) — or lazily from the native
 * services themselves via `ensureNativePlatformConfigured()`.
 *
 * NOTE: `@stackbluff/shared` is imported through its `src/*` subpaths.
 * The package currently has no `main`/`exports` field, so the bare
 * `@stackbluff/shared` specifier does not resolve under Metro or tsc.
 * (Integrator request recorded in the worklog: add `"main": "src/index.ts"`.)
 */

const TOKEN_KEY = 'auth_token';

/* ── Storage backends (AsyncStorage) ────────────────────────────────────── */

export const asyncTokenStorage: TokenStorage = {
  async get() {
    try {
      return await AsyncStorage.getItem(TOKEN_KEY);
    } catch {
      return null;
    }
  },
  async set(token) {
    try {
      if (token === null) await AsyncStorage.removeItem(TOKEN_KEY);
      else await AsyncStorage.setItem(TOKEN_KEY, token);
    } catch {
      // Storage failures are non-fatal; auth flows will re-login.
    }
  },
};

export const asyncKvStorage: KVStorage = {
  async getItem(key) {
    try {
      return await AsyncStorage.getItem(key);
    } catch {
      return null;
    }
  },
  async setItem(key, value) {
    try {
      await AsyncStorage.setItem(key, value);
    } catch {
      // Non-fatal.
    }
  },
  async removeItem(key) {
    try {
      await AsyncStorage.removeItem(key);
    } catch {
      // Non-fatal.
    }
  },
};

/* ── Haptics backend (expo-haptics) ─────────────────────────────────────── */

function fireHaptic(promise: Promise<void>): void {
  promise.catch(() => {
    // Haptic failures must never surface to users.
  });
}

export const expoHapticsBackend: HapticsBackend = {
  impact(style) {
    const map = {
      light: ExpoHaptics.ImpactFeedbackStyle.Light,
      medium: ExpoHaptics.ImpactFeedbackStyle.Medium,
      heavy: ExpoHaptics.ImpactFeedbackStyle.Heavy,
    } as const;
    fireHaptic(ExpoHaptics.impactAsync(map[style]));
  },
  success() {
    fireHaptic(ExpoHaptics.notificationAsync(ExpoHaptics.NotificationFeedbackType.Success));
  },
  warning() {
    fireHaptic(ExpoHaptics.notificationAsync(ExpoHaptics.NotificationFeedbackType.Warning));
  },
  error() {
    fireHaptic(ExpoHaptics.notificationAsync(ExpoHaptics.NotificationFeedbackType.Error));
  },
  selection() {
    fireHaptic(ExpoHaptics.selectionAsync());
  },
};

/* ── Audio backend ──────────────────────────────────────────────────────── */
/**
 * Game sounds on native require bundled audio assets (the PWA synthesizes
 * its sounds with the Web Audio API, which does not exist in RN). Until the
 * asset set ships, the backend is an enabled-aware no-op: `setEnabled`
 * state is tracked so an asset-backed implementation can be dropped in
 * without touching callers (the shared feedback controller just calls
 * `play(preset)`).
 */
export const nativeAudioBackend: AudioBackend = (() => {
  let enabled = true;
  return {
    play(preset, opts) {
      if (!enabled) return;
      if (__DEV__ && (opts?.volume ?? 1) > 0) {
        // Visible in dev only — keeps the missing-asset situation honest.
        console.log(`[audio] preset '${preset}' not bundled on native yet — skipped`);
      }
    },
    setEnabled(b) {
      enabled = b;
    },
  };
})();

/* ── URLs ───────────────────────────────────────────────────────────────── */

/** Backend origin for REST (same value the surface gets). */
export function getRestBaseUrl(): string {
  return getApiBaseUrl();
}

/** WS base (wss://host) — EXPO_PUBLIC_WS_URL override, else derived from the REST base. */
export function getWsBaseUrl(): string {
  const fromEnv = process.env.EXPO_PUBLIC_WS_URL;
  if (fromEnv && fromEnv.trim().length > 0) return fromEnv.trim().replace(/\/+$/, '');
  const rest = getRestBaseUrl();
  if (!rest) return '';
  return rest.replace(/^http/, 'ws').replace(/\/+$/, '');
}

/* ── Network (NetInfo seam) ─────────────────────────────────────────────── */
/**
 * Registrar backed by @react-native-community/netinfo: the shared websocket
 * hook subscribes to revive its connection when the device comes back online.
 */
export const netInfoOnNetworkChange: OnNetworkChange = (onOnline) => {
  const unsubscribe = NetInfo.addEventListener((state) => {
    if (state.isConnected && state.isInternetReachable !== false) onOnline(true);
  });
  return unsubscribe;
};

/* ── Boot ───────────────────────────────────────────────────────────────── */

let configured = false;

/**
 * Idempotent boot: configures the shared platform surface and the game
 * websocket bridge. Called from the root layout (A5) and lazily by the
 * native services (push/purchases) so they work even before layout wiring.
 */
export function ensureNativePlatformConfigured(): boolean {
  if (configured) return true;
  configured = true;

  configurePlatform({
    platformId: Platform.OS === 'ios' ? 'ios' : 'android',
    tokenStorage: asyncTokenStorage,
    kvStorage: asyncKvStorage,
    haptics: expoHapticsBackend,
    audio: nativeAudioBackend,
    api: { baseUrl: getRestBaseUrl() },
    onNetworkChange: netInfoOnNetworkChange,
  });

  configureGameWebSocketBridge({
    // Same console toasts as the bridge default, spelled out because the
    // bridge config is a full interface (hosts override every integration).
    toast: {
      success: (...args: unknown[]) => console.log(...args),
      error: (...args: unknown[]) => console.error(...args),
    },
    wsBaseUrl: getWsBaseUrl,
    // Native fingerprinting is an A5/integrator concern; a no-op keeps the
    // shared hook working without it.
    submitFingerprint: () => {},
    // Pass-through validator (same semantics as the bridge default). A5 can
    // swap in a zod schema mirroring the PWA's lib/wsMessages if needed.
    userUpdatedSchema: {
      safeParse: (data: unknown) => ({ success: true, data: data as UserUpdatedMessage }),
    },
    authStore: {
      getState: () => ({
        setBalance: (balance: number) => useEntitlementsStore.getState().setChips(balance),
      }),
    },
    entitlementsStore: {
      getState: () => ({
        setSeasonPassExpiresAt: (v: string | null) => {
          useEntitlementsStore.getState().setEntitlements({ isSeasonPass: v != null });
        },
        setClubProExpiresAt: (v: string | null) => {
          useEntitlementsStore.getState().setEntitlements({ isClubPro: v != null });
        },
        setIsClubOwner: () => {
          // Club ownership is surfaced through the club screens, not here.
        },
      }),
    },
  });

  return true;
}

/** True once `ensureNativePlatformConfigured` has run. */
export function nativePlatformConfigured(): boolean {
  return configured;
}

/**
 * Platform surface — the single injection seam between @stackbluff/shared
 * and the host platform (PWA browser, Telegram, iOS, Android).
 *
 * Rules (see docs/mobile-plan/contracts/shared-rn-surface.md):
 * - shared must never import React Native or Expo packages. Native hosts call
 *   `configurePlatform(surface)` once at boot to inject their backends.
 * - When no surface is configured, `getPlatformSurface()` returns the web
 *   defaults from `./web-defaults` (localStorage, WebAudio, Vibration API),
 *   which keeps PWA behavior byte-identical to the pre-surface code.
 */

import { getWebDefaultSurface } from './web-defaults';

export interface TokenStorage {
  get(): Promise<string | null>;
  set(t: string | null): Promise<void>;
}

export interface KVStorage {
  getItem(k: string): Promise<string | null>;
  setItem(k: string, v: string): Promise<void>;
  removeItem(k: string): Promise<void>;
}

export interface HapticsBackend {
  impact(style: 'light' | 'medium' | 'heavy'): void;
  success(): void;
  warning(): void;
  error(): void;
  selection(): void;
}

export interface AudioBackend {
  play(preset: string, opts?: { volume?: number }): void;
  setEnabled(b: boolean): void;
}

export interface ApiConfig {
  baseUrl: string;
}

/**
 * Registers a network-status listener. Returns an unsubscribe function.
 * Web default: window `online`/`offline` events. Mobile: NetInfo (injected
 * by the mobile app via configurePlatform).
 */
export type OnNetworkChange = (cb: (online: boolean) => void) => () => void;

export interface PlatformSurface {
  tokenStorage: TokenStorage;
  kvStorage: KVStorage;
  haptics: HapticsBackend;
  audio: AudioBackend;
  api: ApiConfig;
  platformId: 'web' | 'ios' | 'android';
  /** Optional. Web default: window online/offline events. */
  onNetworkChange?: OnNetworkChange;
}

let configuredSurface: PlatformSurface | null = null;

/**
 * Configure the platform surface for this session. Idempotent with
 * last-wins semantics for the SAME platformId; calling it twice with
 * DIFFERENT platformIds throws (a host must never switch platforms
 * mid-session).
 */
export function configurePlatform(surface: PlatformSurface): void {
  if (configuredSurface && configuredSurface.platformId !== surface.platformId) {
    throw new Error(
      `[platform] configurePlatform: already configured as '${configuredSurface.platformId}', cannot reconfigure as '${surface.platformId}'`,
    );
  }
  configuredSurface = surface;
}

/** Returns the configured surface, or the web defaults when unconfigured. */
export function getPlatformSurface(): PlatformSurface {
  if (configuredSurface) return configuredSurface;
  return getWebDefaultSurface();
}

/**
 * Dependency bridge for the shared useGameWebSocket hook.
 *
 * The game websocket hook is platform-agnostic, but it has a few host
 * integrations that live in the PWA app (sonner toasts, device
 * fingerprinting, the user.updated zod schema, pwa auth/entitlements stores,
 * and the VITE_WS_URL build env). Those are injected here by the host's
 * `useGameWebSocket` shim module, which every PWA consumer imports, so the
 * bridge is always configured before the hook runs on web.
 *
 * Mobile hosts (A5) call `configureGameWebSocketBridge()` with their own
 * implementations (e.g. a native toast library and RN fingerprinting).
 */

/** Shape of the `user.updated` WS message after schema parsing. */
export interface UserUpdatedPayload {
  balance?: number;
  season_pass_expires_at?: string | null;
  club_pro_expires_at?: string | null;
  is_club_owner?: boolean;
}

export interface UserUpdatedMessage {
  type: 'user.updated';
  payload?: UserUpdatedPayload;
  data?: UserUpdatedPayload;
}

/** Minimal structural type compatible with a zod schema's safeParse. */
export interface UserUpdatedSchemaLike {
  safeParse(data: unknown): UserUpdatedParseResult;
}

export type UserUpdatedParseResult =
  | { success: true; data: UserUpdatedMessage; error?: undefined }
  | { success: false; data?: undefined; error: { format(): unknown } };

export interface GameWebSocketToast {
  success(...args: unknown[]): unknown;
  error(...args: unknown[]): unknown;
}

export interface GameWebSocketAuthStoreLike {
  getState(): {
    setBalance(balance: number): void;
  };
}

export interface GameWebSocketEntitlementsStoreLike {
  getState(): {
    setSeasonPassExpiresAt(v: string | null): void;
    setClubProExpiresAt(v: string | null): void;
    setIsClubOwner(v: boolean): void;
  };
}

export interface GameWebSocketBridge {
  /** Toast notifications (web: sonner). */
  toast: GameWebSocketToast;
  /** Resolve the game WS base URL, e.g. `wss://host` (web: VITE_WS_URL or current origin). */
  wsBaseUrl(): string;
  /** Submit the device fingerprint for anti-cheat (web: pwa fingerprint service). */
  submitFingerprint(token: string): Promise<void> | void;
  /** Validator for `user.updated` messages (web: pwa wsMessages zod schema). */
  userUpdatedSchema: UserUpdatedSchemaLike;
  /** Auth store used to fan out balance updates. */
  authStore: GameWebSocketAuthStoreLike;
  /** Entitlements store used to fan out season-pass/club-pro updates. */
  entitlementsStore: GameWebSocketEntitlementsStoreLike;
}

const defaultBridge: GameWebSocketBridge = {
  toast: {
    success: (...args: unknown[]) => console.log(...args),
    error: (...args: unknown[]) => console.error(...args),
  },
  wsBaseUrl: () => {
    if (typeof window === 'undefined') return '';
    const proto = window.location.protocol === 'https:' ? 'wss' : 'ws';
    return `${proto}://${window.location.host}`;
  },
  submitFingerprint: () => {},
  userUpdatedSchema: {
    safeParse: (data: unknown) => ({ success: true, data: data as UserUpdatedMessage }),
  },
  authStore: {
    getState: () => ({ setBalance: () => {} }),
  },
  entitlementsStore: {
    getState: () => ({
      setSeasonPassExpiresAt: () => {},
      setClubProExpiresAt: () => {},
      setIsClubOwner: () => {},
    }),
  },
};

let bridge: GameWebSocketBridge = defaultBridge;

/** Configure host integrations for the game websocket hook. Last-wins. */
export function configureGameWebSocketBridge(partial: GameWebSocketBridge): void {
  bridge = { ...defaultBridge, ...partial };
}

/** Returns the configured bridge (web-safe defaults when unconfigured). */
export function getGameWebSocketBridge(): GameWebSocketBridge {
  return bridge;
}

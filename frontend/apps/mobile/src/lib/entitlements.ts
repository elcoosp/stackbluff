import { create } from 'zustand';

/**
 * Client-side entitlement store (Agent-06 lane: src/lib/entitlements.ts).
 *
 * Fed by three sources:
 *  - `services/native/purchases.ts` maps RevenueCat `CustomerInfo` updates
 *    onto pass/pro flags and optimistic chip credits.
 *  - The backend `/api/payments/revenuecat/verify` response provides the
 *    authoritative chip grant after a purchase.
 *  - The shared game websocket bridge (`services/native/platform.ts`) fans
 *    `user.updated` balance pushes into `setChips`.
 *
 * Kept dependency-free (no RevenueCat types here) so screens (A5) and the
 * shop sheet can consume it without pulling native modules.
 */

export type ProductId = 'chips_10k' | 'chips_50k' | 'chips_200k' | 'season_pass' | 'club_pro';

/** Chip grants per consumable product (mirrors the backend mapping). */
export const PRODUCT_CHIP_GRANTS: Record<string, number> = {
  chips_10k: 10_000,
  chips_50k: 50_000,
  chips_200k: 200_000,
};

/** RevenueCat entitlement identifiers we care about. */
export const SEASON_PASS_ENTITLEMENT = 'season_pass';
export const CLUB_PRO_ENTITLEMENT = 'club_pro';

/**
 * Minimal structural subset of RevenueCat's `CustomerInfo` we consume.
 * Declared locally so this module never imports `react-native-purchases`.
 */
export interface CustomerInfoLike {
  entitlements?: { active?: Record<string, unknown> | null } | null;
}

export interface EntitlementsState {
  /** Authoritative chip balance, null until first known value arrives. */
  chips: number | null;
  isSeasonPass: boolean;
  isClubPro: boolean;
  /** Epoch ms of the last successful purchase verification. */
  lastVerifiedAt: number | null;
  /** Absolute chip balance setter (backend/websocket fanout). */
  setChips: (chips: number | null) => void;
  /** Partial update — only the fields present are touched. */
  setEntitlements: (update: {
    chips?: number;
    isSeasonPass?: boolean;
    isClubPro?: boolean;
    lastVerifiedAt?: number;
  }) => void;
  /** Consume a RevenueCat CustomerInfo-shaped object (flags = current truth). */
  setFromCustomerInfo: (info: CustomerInfoLike) => void;
  /** Add (or, with a negative delta, subtract) chips optimistically. */
  creditChips: (delta: number) => void;
  reset: () => void;
}

const initial = {
  chips: null,
  isSeasonPass: false,
  isClubPro: false,
  lastVerifiedAt: null,
} as const;

export const useEntitlementsStore = create<EntitlementsState>((set) => ({
  ...initial,
  setChips: (chips) => set({ chips }),
  setEntitlements: (update) => set((state) => ({ ...state, ...update })),
  setFromCustomerInfo: (info) =>
    set(() => {
      const active = info.entitlements?.active ?? {};
      return {
        isSeasonPass: active[SEASON_PASS_ENTITLEMENT] != null,
        isClubPro: active[CLUB_PRO_ENTITLEMENT] != null,
      };
    }),
  creditChips: (delta) =>
    set((state) => ({
      chips: Math.max(0, (state.chips ?? 0) + delta),
    })),
  reset: () => set({ ...initial }),
}));

/**
 * Selector hook over the entitlements store (public surface name).
 * Equivalent to `useEntitlementsStore` — kept as a distinct export so
 * screens can read `const { chips, isSeasonPass } = useEntitlements();`.
 */
export const useEntitlements = useEntitlementsStore;

/** Chips granted by a consumable product id, or 0 for non-chip products. */
export function chipsForProduct(productId: string): number {
  return PRODUCT_CHIP_GRANTS[productId] ?? 0;
}

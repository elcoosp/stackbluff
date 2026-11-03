import {
  configureGameWebSocketBridge,
  type UserUpdatedMessage,
  type UserUpdatedPayload,
} from '@stackbluff/shared/src/hooks/gameWebSocketBridge';
import { useGameWebSocket } from '@stackbluff/shared/src/hooks/useGameWebSocket';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { type ReactNode, useEffect, useRef } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { z } from 'zod';
import { useEntitlementsStore } from './lib/entitlements';
import { applyFeedbackPrefsAtBoot } from './lib/prefs';
import { ToastProvider, toast } from './lib/toast';
import {
  addNotificationListeners,
  ensureNativePlatformConfigured,
  getWsBaseUrl,
  initializePurchases,
  initializeSentry,
  startCustomerInfoListener,
} from './services/native';
import { useAuthStore } from './stores/authStore';

/**
 * Boot providers (Task 3-b).
 *
 * Module-level side effects run once at import (before the first render):
 *  1. `initializeSentry()` — no-op without EXPO_PUBLIC_SENTRY_DSN.
 *  2. `ensureNativePlatformConfigured()` — configurePlatform (AsyncStorage
 *     token/KV, expo-haptics, audio backend, EXPO_PUBLIC_API_URL base) +
 *     the websocket bridge defaults from Agent-06's platform.ts.
 *  3. Bridge refinement — the in-app toast system replaces console toasts,
 *     the zod `user.updated` schema mirrors the PWA's lib/wsMessages.ts, and
 *     balance fanout targets the mobile auth store.
 *
 * NOTE (NetInfo): the `onNetworkChange` registrar lives in
 * services/native/platform.ts (NetInfo-backed) — the shared websocket hook
 * auto-revives its connection when the device comes back online.
 */

initializeSentry();
ensureNativePlatformConfigured();

/** Mirrors apps/pwa/src/lib/wsMessages.ts UserUpdatedPayloadSchema (zod). */
const userUpdatedZod = z.object({
  type: z.literal('user.updated'),
  payload: z
    .object({
      balance: z.number().optional(),
      season_pass_expires_at: z.string().nullable().optional(),
      club_pro_expires_at: z.string().nullable().optional(),
      is_club_owner: z.boolean().optional(),
    })
    .optional(),
  data: z
    .object({
      balance: z.number().optional(),
      season_pass_expires_at: z.string().nullable().optional(),
      club_pro_expires_at: z.string().nullable().optional(),
      is_club_owner: z.boolean().optional(),
    })
    .optional(),
});

const UserUpdatedPayloadSchema = {
  safeParse(data: unknown) {
    const result = userUpdatedZod.safeParse(data);
    if (result.success) {
      return { success: true as const, data: result.data as UserUpdatedMessage };
    }
    return {
      success: false as const,
      data: undefined,
      error: { format: () => result.error.format() },
    };
  },
};

configureGameWebSocketBridge({
  toast: {
    success: (message: unknown, ...rest: unknown[]) => toast.success(message, ...rest),
    error: (message: unknown, ...rest: unknown[]) => toast.error(message, ...rest),
  },
  wsBaseUrl: getWsBaseUrl,
  // Native device fingerprinting is an integrator concern (A6 note); no-op.
  submitFingerprint: () => {},
  userUpdatedSchema: UserUpdatedPayloadSchema,
  authStore: {
    getState: () => ({
      setBalance: (balance: number) => {
        useAuthStore.getState().setBalance(balance);
        useEntitlementsStore.getState().setChips(balance);
      },
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
      setIsClubOwner: () => {},
    }),
  },
});

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 15_000,
    },
  },
});

/**
 * Boot services — token hydration + `/auth/me`, push tap listeners,
 * lazy RevenueCat init on login, customer-info entitlement sync.
 */
function BootServices() {
  const hydratedRef = useRef(false);

  useEffect(() => {
    if (hydratedRef.current) return;
    hydratedRef.current = true;
    void (async () => {
      // Restore persisted feedback prefs (audio.setEnabled from the audio
      // settings screen) before the first tables render.
      await applyFeedbackPrefsAtBoot();
      await useAuthStore.getState().hydrate();
      await useAuthStore.getState().loadUser();
    })();
  }, []);

  // Notification tap listeners (cold start + warm taps) — mounted once.
  useEffect(() => {
    const cleanup = addNotificationListeners({
      onTap: () => {},
    });
    return cleanup;
  }, []);

  // Lazy purchases init per authenticated user + entitlements listener.
  useEffect(() => {
    const unsubscribeAuth = useAuthStore.subscribe((state) => {
      const userId = state.user?.id ?? null;
      if (userId && purchasesForUser.current !== userId) {
        purchasesForUser.current = userId;
        void initializePurchases({ appUserId: userId });
      }
    });
    const unsubscribeInfo = startCustomerInfoListener();
    return () => {
      unsubscribeAuth();
      unsubscribeInfo();
    };
  }, []);

  return null;
}

const purchasesForUser = { current: null as string | null };

export function Providers({ children }: { children: ReactNode }) {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <ToastProvider>
            <BootServices />
            {children}
          </ToastProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

export type { UserUpdatedPayload };
// Re-export so screens import the hook through the configured bridge module
// (mirrors the PWA's useGameWebSocket shim pattern).
export { useGameWebSocket };

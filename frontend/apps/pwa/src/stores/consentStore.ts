import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { CONSENT_STORAGE_KEY, MAYBE_LATER_COOLDOWN_MS } from '@/lib/consent/constants';

export type NotificationConsent = 'granted' | 'denied' | 'default' | 'not_asked';
export type CookieConsent = 'accepted' | 'declined' | 'not_set';

interface ConsentState {
  // Notification consent
  notificationConsent: NotificationConsent;
  notificationPromptDismissedAt: number | null; // timestamp for "maybe later"

  // Cookie consent
  cookieConsent: CookieConsent;

  // Actions (pure state updates, no side effects)
  setNotificationConsent: (consent: NotificationConsent) => void;
  dismissNotificationPrompt: () => void; // "Maybe later"
  setCookieConsent: (consent: CookieConsent) => void;

  // Derived checks
  hasCookieConsent: () => boolean;
  canShowNotificationPrompt: () => boolean;
  isNotificationPromptCooldownActive: () => boolean;
}

export const useConsentStore = create<ConsentState>()(
  persist(
    (set, get) => ({
      // Initial state
      notificationConsent: 'not_asked',
      notificationPromptDismissedAt: null,
      cookieConsent: 'not_set',

      // Pure state updates (no side effects)
      setNotificationConsent: (consent) => {
        set({ notificationConsent: consent });
      },

      dismissNotificationPrompt: () => {
        set({
          notificationPromptDismissedAt: Date.now(),
        });
      },

      setCookieConsent: (consent) => {
        set({ cookieConsent: consent });
      },

      // Derived checks
      hasCookieConsent: () => {
        return get().cookieConsent === 'accepted';
      },

      isNotificationPromptCooldownActive: () => {
        const dismissedAt = get().notificationPromptDismissedAt;
        if (!dismissedAt) return false;
        const elapsed = Date.now() - dismissedAt;
        return elapsed < MAYBE_LATER_COOLDOWN_MS;
      },

      canShowNotificationPrompt: () => {
        const state = get();

        // Don't show if already granted or explicitly denied
        if (state.notificationConsent === 'granted' || state.notificationConsent === 'denied') {
          return false;
        }

        // Don't show if browser permission is already decided
        if (typeof window !== 'undefined' && 'Notification' in window) {
          if (Notification.permission === 'granted' || Notification.permission === 'denied') {
            return false;
          }
        }

        // If dismissed ("maybe later"), check cooldown
        if (state.isNotificationPromptCooldownActive()) {
          return false;
        }

        return true;
      },
    }),
    {
      name: CONSENT_STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        // Persist all relevant state
        notificationConsent: state.notificationConsent,
        notificationPromptDismissedAt: state.notificationPromptDismissedAt,
        cookieConsent: state.cookieConsent,
      }),
    },
  ),
);

// Helper for analytics wrapper
export function canFireAnalytics(): boolean {
  if (typeof window === 'undefined') return false;
  return useConsentStore.getState().cookieConsent === 'accepted';
}

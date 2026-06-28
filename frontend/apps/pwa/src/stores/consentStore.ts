import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export type NotificationConsent = 'granted' | 'denied' | 'default' | 'not_asked';
export type CookieConsent = 'accepted' | 'declined' | 'not_set';

interface ConsentState {
  // Notification consent
  notificationConsent: NotificationConsent;
  notificationPromptShown: boolean;
  notificationPromptDismissedAt: number | null; // timestamp for "maybe later"

  // Cookie consent
  cookieConsent: CookieConsent;

  // Actions
  setNotificationConsent: (consent: NotificationConsent) => void;
  markNotificationPromptShown: () => void;
  dismissNotificationPrompt: () => void; // "Maybe later"
  setCookieConsent: (consent: CookieConsent) => void;

  // Derived checks
  hasCookieConsent: () => boolean;
  canShowNotificationPrompt: () => boolean;
}

const MAYBE_LATER_COOLDOWN_MS = 24 * 60 * 60 * 1000; // 24 hours

export const useConsentStore = create<ConsentState>()(
  persist(
    (set, get) => ({
      // Initial state
      notificationConsent: 'not_asked',
      notificationPromptShown: false,
      notificationPromptDismissedAt: null,
      cookieConsent: 'not_set',

      // Notification actions
      setNotificationConsent: (consent) => {
        set({ notificationConsent: consent });
        // Sync with browser permission if applicable
        if (typeof window !== 'undefined' && 'Notification' in window) {
          if (consent === 'granted' && Notification.permission !== 'granted') {
            Notification.requestPermission().then((perm) => {
              set({ notificationConsent: perm as NotificationConsent });
            });
          }
        }
      },

      markNotificationPromptShown: () => {
        set({ notificationPromptShown: true });
      },

      dismissNotificationPrompt: () => {
        set({
          notificationPromptShown: false,
          notificationPromptDismissedAt: Date.now(),
        });
      },

      // Cookie actions
      setCookieConsent: (consent) => {
        set({ cookieConsent: consent });
      },

      // Derived checks
      hasCookieConsent: () => {
        return get().cookieConsent === 'accepted';
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

        // If dismissed ("maybe later"), wait 24 hours
        if (state.notificationPromptDismissedAt) {
          const elapsed = Date.now() - state.notificationPromptDismissedAt;
          if (elapsed < MAYBE_LATER_COOLDOWN_MS) {
            return false;
          }
        }

        return true;
      },
    }),
    {
      name: 'stackbluff-consent',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        // Only persist what we need
        notificationConsent: state.notificationConsent,
        notificationPromptDismissedAt: state.notificationPromptDismissedAt,
        cookieConsent: state.cookieConsent,
      }),
    }
  )
);

// Helper for analytics wrapper
export function canFireAnalytics(): boolean {
  if (typeof window === 'undefined') return false;
  return useConsentStore.getState().cookieConsent === 'accepted';
}

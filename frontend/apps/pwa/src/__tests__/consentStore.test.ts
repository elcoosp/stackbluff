import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useConsentStore } from '../stores/consentStore';
import { MAYBE_LATER_COOLDOWN_MS } from '../lib/consent/constants';

// Mock Notification API
const mockNotificationPermission = vi.fn();
Object.defineProperty(window, 'Notification', {
  value: {
    permission: 'default',
    requestPermission: mockNotificationPermission,
  },
  writable: true,
  configurable: true,
});

describe('consentStore', () => {
  beforeEach(() => {
    // Reset store before each test
    useConsentStore.setState({
      notificationConsent: 'not_asked',
      notificationPromptDismissedAt: null,
      cookieConsent: 'not_set',
    });

    // Reset Notification permission
    (window.Notification as any).permission = 'default';
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('cookie consent', () => {
    it('should start with not_set', () => {
      const state = useConsentStore.getState();
      expect(state.cookieConsent).toBe('not_set');
    });

    it('should update cookie consent', () => {
      const { setCookieConsent } = useConsentStore.getState();
      setCookieConsent('accepted');
      expect(useConsentStore.getState().cookieConsent).toBe('accepted');
    });

    it('should return true for hasCookieConsent when accepted', () => {
      const { setCookieConsent, hasCookieConsent } = useConsentStore.getState();
      setCookieConsent('accepted');
      expect(hasCookieConsent()).toBe(true);
    });

    it('should return false for hasCookieConsent when declined', () => {
      const { setCookieConsent, hasCookieConsent } = useConsentStore.getState();
      setCookieConsent('declined');
      expect(hasCookieConsent()).toBe(false);
    });

    it('should return false for hasCookieConsent when not_set', () => {
      const { hasCookieConsent } = useConsentStore.getState();
      expect(hasCookieConsent()).toBe(false);
    });
  });

  describe('notification consent', () => {
    it('should start with not_asked', () => {
      const state = useConsentStore.getState();
      expect(state.notificationConsent).toBe('not_asked');
    });

    it('should update notification consent', () => {
      const { setNotificationConsent } = useConsentStore.getState();
      setNotificationConsent('granted');
      expect(useConsentStore.getState().notificationConsent).toBe('granted');
    });

    it('should not show prompt when granted', () => {
      const { setNotificationConsent, canShowNotificationPrompt } = useConsentStore.getState();
      setNotificationConsent('granted');
      expect(canShowNotificationPrompt()).toBe(false);
    });

    it('should not show prompt when denied', () => {
      const { setNotificationConsent, canShowNotificationPrompt } = useConsentStore.getState();
      setNotificationConsent('denied');
      expect(canShowNotificationPrompt()).toBe(false);
    });

    it('should show prompt when not_asked and browser permission is default', () => {
      (window.Notification as any).permission = 'default';
      const { canShowNotificationPrompt } = useConsentStore.getState();
      expect(canShowNotificationPrompt()).toBe(true);
    });

    it('should not show prompt when browser permission is granted', () => {
      (window.Notification as any).permission = 'granted';
      const { canShowNotificationPrompt } = useConsentStore.getState();
      expect(canShowNotificationPrompt()).toBe(false);
    });

    it('should not show prompt when browser permission is denied', () => {
      (window.Notification as any).permission = 'denied';
      const { canShowNotificationPrompt } = useConsentStore.getState();
      expect(canShowNotificationPrompt()).toBe(false);
    });
  });

  describe('maybe later cooldown', () => {
    it('should not show prompt during cooldown', () => {
      const { dismissNotificationPrompt, canShowNotificationPrompt } = useConsentStore.getState();
      dismissNotificationPrompt();
      expect(canShowNotificationPrompt()).toBe(false);
    });

    it('should set dismissed timestamp when dismissing prompt', () => {
      const { dismissNotificationPrompt } = useConsentStore.getState();
      const beforeDismiss = Date.now();
      dismissNotificationPrompt();
      const afterDismiss = Date.now();

      const state = useConsentStore.getState();
      expect(state.notificationPromptDismissedAt).toBeGreaterThanOrEqual(beforeDismiss);
      expect(state.notificationPromptDismissedAt).toBeLessThanOrEqual(afterDismiss);
    });

    it('should show prompt after cooldown expires', () => {
      // Manually set dismissed time to past (beyond cooldown)
      useConsentStore.setState({
        notificationPromptDismissedAt: Date.now() - MAYBE_LATER_COOLDOWN_MS - 1000,
      });

      const { canShowNotificationPrompt } = useConsentStore.getState();
      expect(canShowNotificationPrompt()).toBe(true);
    });

    it('should not show prompt if cooldown has not expired', () => {
      // Set dismissed time to recent (within cooldown)
      useConsentStore.setState({
        notificationPromptDismissedAt: Date.now() - 1000, // 1 second ago
      });

      const { canShowNotificationPrompt } = useConsentStore.getState();
      expect(canShowNotificationPrompt()).toBe(false);
    });

    it('should check cooldown correctly with isNotificationPromptCooldownActive', () => {
      const { dismissNotificationPrompt, isNotificationPromptCooldownActive } = useConsentStore.getState();

      // Before dismissing
      expect(isNotificationPromptCooldownActive()).toBe(false);

      // After dismissing
      dismissNotificationPrompt();
      expect(isNotificationPromptCooldownActive()).toBe(true);
    });
  });

  describe('persistence', () => {
    it('should persist consent state to localStorage', () => {
      const { setCookieConsent } = useConsentStore.getState();
      setCookieConsent('accepted');

      // Check localStorage was updated
      const stored = localStorage.getItem('stackbluff-consent');
      expect(stored).toBeTruthy();

      const parsed = JSON.parse(stored!);
      expect(parsed.state.cookieConsent).toBe('accepted');
    });

    it('should persist notification consent to localStorage', () => {
      const { setNotificationConsent } = useConsentStore.getState();
      setNotificationConsent('granted');

      const stored = localStorage.getItem('stackbluff-consent');
      expect(stored).toBeTruthy();

      const parsed = JSON.parse(stored!);
      expect(parsed.state.notificationConsent).toBe('granted');
    });

    it('should persist dismissed timestamp to localStorage', () => {
      const { dismissNotificationPrompt } = useConsentStore.getState();
      dismissNotificationPrompt();

      const stored = localStorage.getItem('stackbluff-consent');
      expect(stored).toBeTruthy();

      const parsed = JSON.parse(stored!);
      expect(parsed.state.notificationPromptDismissedAt).toBeTruthy();
      expect(typeof parsed.state.notificationPromptDismissedAt).toBe('number');
    });
  });
});

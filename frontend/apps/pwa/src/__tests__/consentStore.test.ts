import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useConsentStore } from '../stores/consentStore';
import { MAYBE_LATER_COOLDOWN_MS } from '../lib/consent/constants';

describe('consentStore', () => {
  beforeEach(() => {
    // Reset store before each test
    useConsentStore.setState({
      notificationConsent: 'not_asked',
      notificationPromptDismissedAt: null,
      cookieConsent: 'not_set',
    });
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

    it('should show prompt when not_asked', () => {
      const { canShowNotificationPrompt } = useConsentStore.getState();
      expect(canShowNotificationPrompt()).toBe(true);
    });
  });

  describe('maybe later cooldown', () => {
    it('should not show prompt during cooldown', () => {
      const { dismissNotificationPrompt, canShowNotificationPrompt } = useConsentStore.getState();
      dismissNotificationPrompt();
      expect(canShowNotificationPrompt()).toBe(false);
    });

    it('should show prompt after cooldown expires', () => {
      const { dismissNotificationPrompt, canShowNotificationPrompt } = useConsentStore.getState();

      // Manually set dismissed time to past
      useConsentStore.setState({
        notificationPromptDismissedAt: Date.now() - MAYBE_LATER_COOLDOWN_MS - 1000,
      });

      expect(canShowNotificationPrompt()).toBe(true);
    });
  });
});

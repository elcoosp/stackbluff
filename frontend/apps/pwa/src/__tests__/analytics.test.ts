import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { trackEvent, trackPageView } from '../lib/analytics';
import { useConsentStore } from '../stores/consentStore';

type MockWindow = Window & {
  plausible?: (eventName: string, options?: Record<string, unknown>) => void;
};

describe('analytics', () => {
  beforeEach(() => {
    // Reset store
    useConsentStore.setState({
      cookieConsent: 'not_set',
    });

    // Mock window.plausible
    (window as MockWindow).plausible = vi.fn();
    window.dataLayer = [];
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('consent checking', () => {
    it('should not fire events when cookie consent not given', () => {
      trackEvent('test_event');
      expect((window as MockWindow).plausible).not.toHaveBeenCalled();
      expect(window.dataLayer).toHaveLength(0);
    });

    it('should not fire events when cookie consent declined', () => {
      useConsentStore.getState().setCookieConsent('declined');
      trackEvent('test_event');
      expect((window as MockWindow).plausible).not.toHaveBeenCalled();
      expect(window.dataLayer).toHaveLength(0);
    });

    it('should fire events when cookie consent accepted', () => {
      useConsentStore.getState().setCookieConsent('accepted');
      trackEvent('test_event', { props: { foo: 'bar' } });
      expect((window as MockWindow).plausible).toHaveBeenCalledWith('test_event', {
        props: { foo: 'bar' },
      });
    });
  });

  describe('analytics providers', () => {
    it('should use Plausible when available', () => {
      useConsentStore.getState().setCookieConsent('accepted');
      trackEvent('test_event', { props: { foo: 'bar' } });
      expect((window as MockWindow).plausible).toHaveBeenCalledWith('test_event', {
        props: { foo: 'bar' },
      });
    });

    it('should fallback to dataLayer when Plausible not available', () => {
      delete (window as MockWindow).plausible;
      useConsentStore.getState().setCookieConsent('accepted');
      trackEvent('test_event', { props: { foo: 'bar' } });
      expect(window.dataLayer).toContainEqual({
        event: 'test_event',
        foo: 'bar',
      });
    });

    it('should handle missing window object gracefully', () => {
      const originalWindow = global.window;
      // @ts-expect-error
      delete global.window;

      expect(() => trackEvent('test_event')).not.toThrow();

      global.window = originalWindow;
    });
  });

  describe('callbacks', () => {
    it('should call callback after firing event', () => {
      const callback = vi.fn();
      useConsentStore.getState().setCookieConsent('accepted');
      trackEvent('test_event', { callback });
      expect(callback).toHaveBeenCalled();
    });

    it('should not call callback when consent not given', () => {
      const callback = vi.fn();
      trackEvent('test_event', { callback });
      expect(callback).not.toHaveBeenCalled();
    });

    it('should handle callback errors gracefully', () => {
      const callback = vi.fn(() => {
        throw new Error('Callback error');
      });
      useConsentStore.getState().setCookieConsent('accepted');

      expect(() => trackEvent('test_event', { callback })).not.toThrow();
      expect(callback).toHaveBeenCalled();
    });
  });

  describe('trackPageView', () => {
    it('should track pageview with url', () => {
      useConsentStore.getState().setCookieConsent('accepted');
      trackPageView('https://example.com/page');
      expect((window as MockWindow).plausible).toHaveBeenCalledWith('pageview', {
        props: { url: 'https://example.com/page' },
      });
    });

    it('should track pageview without url', () => {
      useConsentStore.getState().setCookieConsent('accepted');
      trackPageView();
      expect((window as MockWindow).plausible).toHaveBeenCalledWith('pageview', {
        props: {},
      });
    });
  });
});

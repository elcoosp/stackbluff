import { describe, it, expect, beforeEach, vi } from 'vitest';
import { trackEvent } from '../lib/analytics';
import { useConsentStore } from '../stores/consentStore';

describe('analytics', () => {
  beforeEach(() => {
    // Reset store and window
    useConsentStore.setState({
      cookieConsent: 'not_set',
    });

    // Mock window.plausible
    (window as any).plausible = vi.fn();
    window.dataLayer = [];
  });

  it('should not fire events when cookie consent not given', () => {
    trackEvent('test_event');
    expect((window as any).plausible).not.toHaveBeenCalled();
    expect(window.dataLayer).toHaveLength(0);
  });

  it('should fire events when cookie consent accepted', () => {
    useConsentStore.getState().setCookieConsent('accepted');
    trackEvent('test_event', { props: { foo: 'bar' } });
    expect((window as any).plausible).toHaveBeenCalledWith('test_event', { props: { foo: 'bar' } });
  });

  it('should fallback to dataLayer when plausible not available', () => {
    delete (window as any).plausible;
    useConsentStore.getState().setCookieConsent('accepted');
    trackEvent('test_event', { props: { foo: 'bar' } });
    expect(window.dataLayer).toContainEqual({
      event: 'test_event',
      foo: 'bar',
    });
  });

  it('should call callback after firing event', () => {
    const callback = vi.fn();
    useConsentStore.getState().setCookieConsent('accepted');
    trackEvent('test_event', { callback });
    expect(callback).toHaveBeenCalled();
  });
});

import { canFireAnalytics } from '@/stores/consentStore';

/**
 * Fire an analytics event only if the user has given cookie consent.
 * This wraps Plausible (or any other analytics provider).
 */
export function trackEvent(
  eventName: string,
  options?: {
    props?: Record<string, string | number | boolean>;
    callback?: () => void;
  }
): void {
  if (!canFireAnalytics()) {
    return;
  }

  if (typeof window === 'undefined') {
    return;
  }

  // Plausible analytics
  const plausible = (window as any).plausible;
  if (typeof plausible === 'function') {
    plausible(eventName, options);
  } else {
    // Fallback: push to dataLayer for Google Analytics or similar
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({
      event: eventName,
      ...options?.props,
    });
  }
}

/**
 * Track a page view.
 */
export function trackPageView(url?: string): void {
  trackEvent('pageview', {
    props: url ? { url } : {},
  });
}

// Extend Window type for Plausible
declare global {
  interface Window {
    plausible?: (eventName: string, options?: any) => void;
    dataLayer?: any[];
  }
}

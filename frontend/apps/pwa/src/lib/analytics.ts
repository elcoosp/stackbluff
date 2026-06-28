import { canFireAnalytics } from '@/stores/consentStore';
import { analyticsLogger } from '@/lib/logger';

/**
 * Fire an analytics event only if the user has given cookie consent.
 * Wraps Plausible or other analytics providers with consent checking.
 */
export function trackEvent(
  eventName: string,
  options?: {
    props?: Record<string, string | number | boolean>;
    callback?: () => void;
  }
): void {
  if (!canFireAnalytics()) {
    analyticsLogger.debug('Analytics event blocked: no cookie consent', { eventName });
    return;
  }

  if (typeof window === 'undefined') {
    analyticsLogger.warn('Analytics event skipped: no window object', { eventName });
    return;
  }

  analyticsLogger.info('Firing analytics event', { eventName, props: options?.props });

  // Plausible analytics
  const plausible = (window as any).plausible;
  if (typeof plausible === 'function') {
    try {
      plausible(eventName, options);
      analyticsLogger.debug('Plausible event fired', { eventName });
    } catch (error) {
      analyticsLogger.error('Failed to fire Plausible event', error, { eventName });
    }
  } else {
    // Fallback: push to dataLayer for Google Analytics or similar
    try {
      window.dataLayer = window.dataLayer || [];
      window.dataLayer.push({
        event: eventName,
        ...options?.props,
      });
      analyticsLogger.debug('DataLayer event pushed', { eventName });
    } catch (error) {
      analyticsLogger.error('Failed to push to dataLayer', error, { eventName });
    }
  }

  // Call callback if provided
  if (options?.callback) {
    try {
      options.callback();
    } catch (error) {
      analyticsLogger.error('Analytics callback failed', error, { eventName });
    }
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

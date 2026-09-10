import { analyticsLogger } from '@/lib/logger';
import { canFireAnalytics } from '@/stores/consentStore';

/**
 * Fire an analytics event only if the user has given cookie consent.
 * Includes user context (userId, sessionId) for segmentation.
 */
export function trackEvent(
  eventName: string,
  options?: {
    props?: Record<string, string | number | boolean>;
    callback?: () => void;
  },
): void {
  if (!canFireAnalytics()) {
    analyticsLogger.debug('Analytics event blocked: no cookie consent', { eventName });
    return;
  }

  if (typeof window === 'undefined') {
    analyticsLogger.warn('Analytics event skipped: no window object', { eventName });
    return;
  }

  // Enrich with user context
  const enrichedProps = {
    ...options?.props,
    ...((typeof window !== 'undefined' && window.__USER_CONTEXT__) || {}),
  };

  analyticsLogger.info('Firing analytics event', { eventName, props: enrichedProps });

  // Plausible analytics
  const plausible = window.plausible;
  if (typeof plausible === 'function') {
    try {
      plausible(eventName, { ...options, props: enrichedProps });
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
        ...enrichedProps,
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

/**
 * Set user context for analytics enrichment.
 * Should be called when user logs in/out.
 */
export function setAnalyticsUserContext(context: {
  userId?: string;
  sessionId?: string;
  [key: string]: string | number | boolean | undefined;
}): void {
  if (typeof window === 'undefined') return;
  window.__USER_CONTEXT__ = context;
  analyticsLogger.info('Analytics user context set', { userId: context.userId });
}

// Extend Window type
declare global {
  interface Window {
    plausible?: (eventName: string, options?: Record<string, string | number | boolean>) => void;
    dataLayer?: unknown[];
    __USER_CONTEXT__?: Record<string, string | number | boolean>;
  }
}

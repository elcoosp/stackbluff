import { analyticsLogger } from '@/lib/logger';
import { canFireAnalytics } from '@/stores/consentStore';

/**
 * Track custom game events (hand actions, tournament registrations, etc.)
 * This sends events to our custom backend endpoint.
 */
export async function trackGameEvent(
  eventType: string,
  payload: Record<string, string | number | boolean | undefined>,
): Promise<void> {
  if (!canFireAnalytics()) {
    analyticsLogger.debug('Custom analytics event blocked: no cookie consent', { eventType });
    return;
  }

  if (typeof window === 'undefined') {
    analyticsLogger.warn('Custom analytics event skipped: no window object', { eventType });
    return;
  }

  try {
    const response = await fetch('/api/analytics/event', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        event_type: eventType,
        payload,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      analyticsLogger.warn('Custom analytics failed', {
        eventType,
        status: response.status,
        error: errorText,
      });
    } else {
      analyticsLogger.debug('Custom analytics event sent', { eventType, payload });
    }
  } catch (error) {
    analyticsLogger.error('Custom analytics event failed', error, { eventType });
  }
}

/**
 * Convenience method for tracking player actions.
 */
export function trackPlayerAction(
  action: string,
  amount?: number,
  pot?: number,
  street?: string,
): void {
  trackGameEvent('player_action', {
    action,
    amount,
    pot,
    street,
  });
}

/**
 * Track tournament registration.
 */
export function trackTournamentRegistration(
  tournamentId: string,
  tournamentName: string,
  buyIn: number,
): void {
  trackGameEvent('tournament_registration', {
    tournament_id: tournamentId,
    tournament_name: tournamentName,
    buy_in: buyIn,
  });
}

/**
 * Track club navigation.
 */
export function trackClubView(clubId: string, clubName: string): void {
  trackGameEvent('club_view', {
    club_id: clubId,
    club_name: clubName,
  });
}

/**
 * Track shop product view.
 */
export function trackProductView(productId: string, productName: string): void {
  trackGameEvent('product_view', {
    product_id: productId,
    product_name: productName,
  });
}

import { trackEvent } from '@/lib/analytics';
import {
  ANALYTICS_NOTIFICATION_ALLOWED,
  ANALYTICS_NOTIFICATION_DENIED,
  ANALYTICS_NOTIFICATION_SUBSCRIBED,
  ANALYTICS_NOTIFICATION_UNSUBSCRIBED,
} from '@/lib/consent/constants';
import { notificationLogger } from '@/lib/logger';
import { useConsentStore } from '@/stores/consentStore';
import { isPushSupported, requestPermission } from './permission';
import { getPushSubscription, subscriptionToJSON, unsubscribeFromPush } from './subscription';
import { sendSubscriptionToBackend } from './transport';

export { getPermissionStatus, isPushSupported } from './permission';

/**
 * Complete flow: request permission, get subscription, send to backend.
 * Returns true if successful.
 */
export async function subscribeToPushNotifications(): Promise<boolean> {
  const logger = notificationLogger.child({ action: 'subscribe' });

  if (!isPushSupported()) {
    logger.warn('Push notifications not supported');
    return false;
  }

  // Request permission
  logger.info('Starting subscription flow');
  const permission = await requestPermission();

  if (permission !== 'granted') {
    logger.info('Permission denied', { permission });
    useConsentStore.getState().setNotificationConsent(permission as any);
    trackEvent(ANALYTICS_NOTIFICATION_DENIED, { props: { reason: 'permission_denied' } });
    return false;
  }

  logger.info('Permission granted');
  useConsentStore.getState().setNotificationConsent('granted');
  trackEvent(ANALYTICS_NOTIFICATION_ALLOWED);

  // Get subscription
  const subscription = await getPushSubscription();
  if (!subscription) {
    logger.error('Failed to get push subscription');
    return false;
  }

  // Send to backend
  const subscriptionJSON = subscriptionToJSON(subscription);
  const success = await sendSubscriptionToBackend(subscriptionJSON);

  if (success) {
    trackEvent(ANALYTICS_NOTIFICATION_SUBSCRIBED);
  }

  return success;
}

/**
 * Unsubscribe from push notifications.
 */
export async function unsubscribeFromPushNotifications(): Promise<boolean> {
  const logger = notificationLogger.child({ action: 'unsubscribe' });

  logger.info('Starting unsubscribe flow');

  // Unsubscribe from browser
  const browserSuccess = await unsubscribeFromPush();
  if (!browserSuccess) {
    logger.error('Failed to unsubscribe from browser');
    return false;
  }

  // Update consent store
  useConsentStore.getState().setNotificationConsent('default');

  // Notify backend (best effort)
  // Note: We don't have the endpoint anymore after unsubscribing from browser
  // The backend should handle this via the subscription expiring

  trackEvent(ANALYTICS_NOTIFICATION_UNSUBSCRIBED);
  logger.info('Unsubscribe flow completed');

  return true;
}

/**
 * Re-sync the current subscription with the backend.
 * Useful if the user switches browsers or devices.
 */
export async function resyncSubscription(): Promise<boolean> {
  const logger = notificationLogger.child({ action: 'resync' });

  logger.info('Starting resync flow');

  const subscription = await getPushSubscription();
  if (!subscription) {
    logger.warn('No subscription to resync');
    return false;
  }

  const subscriptionJSON = subscriptionToJSON(subscription);
  const success = await sendSubscriptionToBackend(subscriptionJSON);

  if (success) {
    logger.info('Resync successful');
  } else {
    logger.error('Resync failed');
  }

  return success;
}

import { VAPID_PUBLIC_KEY_ENV } from '@/lib/consent/constants';
import { urlBase64ToUint8Array } from '@/lib/crypto/base64url';
import { notificationLogger } from '@/lib/logger';

/**
 * Push subscription management.
 * Handles creating, retrieving, and unsubscribing from push subscriptions.
 */

interface PushSubscriptionJSON {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}

/**
 * Get the VAPID public key as a Uint8Array suitable for PushManager.subscribe().
 * Returns null if not configured or invalid.
 */
function getVapidPublicKeyAsUint8Array(): Uint8Array | null {
  const key = import.meta.env[VAPID_PUBLIC_KEY_ENV] as string | undefined;
  if (!key) {
    notificationLogger.warn('VAPID public key not configured', { envVar: VAPID_PUBLIC_KEY_ENV });
    return null;
  }

  try {
    return urlBase64ToUint8Array(key);
  } catch (error) {
    notificationLogger.error('Failed to decode VAPID public key', error, { keyLength: key.length });
    return null;
  }
}

/**
 * Get existing push subscription (does NOT create).
 * Returns null if no subscription exists.
 */
export async function getExistingSubscription(): Promise<PushSubscription | null> {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    notificationLogger.warn('Push API not supported');
    return null;
  }

  try {
    const registration = await navigator.serviceWorker.ready;
    notificationLogger.debug('Service worker ready', { scope: registration.scope });

    const subscription = await registration.pushManager.getSubscription();

    if (subscription) {
      notificationLogger.info('Existing push subscription found', {
        endpoint: subscription.endpoint,
      });
      return subscription;
    }

    notificationLogger.debug('No existing push subscription');
    return null;
  } catch (error) {
    notificationLogger.error('Failed to get push subscription', error);
    return null;
  }
}

/**
 * Get or create push subscription.
 * Creates a new subscription if one doesn't exist.
 * Uses proper VAPID key encoding (Uint8Array, not string).
 */
export async function getPushSubscription(): Promise<PushSubscription | null> {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    notificationLogger.warn('Push API not supported');
    return null;
  }

  try {
    const registration = await navigator.serviceWorker.ready;
    notificationLogger.debug('Service worker ready', { scope: registration.scope });

    let subscription = await registration.pushManager.getSubscription();

    if (subscription) {
      notificationLogger.info('Existing push subscription found', {
        endpoint: subscription.endpoint,
      });
      return subscription;
    }

    // Create a new subscription with properly encoded VAPID key
    const vapidKeyBytes = getVapidPublicKeyAsUint8Array();
    if (!vapidKeyBytes) {
      notificationLogger.error('Cannot subscribe: VAPID key missing or invalid');
      return null;
    }

    notificationLogger.info('Creating new push subscription');
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: vapidKeyBytes as BufferSource, // Uint8Array, not string
    });

    notificationLogger.info('Push subscription created', {
      endpoint: subscription.endpoint,
    });
    return subscription;
  } catch (error) {
    notificationLogger.error('Failed to get/create push subscription', error);
    return null;
  }
}

export function subscriptionToJSON(subscription: PushSubscription): PushSubscriptionJSON {
  const json = subscription.toJSON();
  return {
    endpoint: subscription.endpoint,
    keys: {
      p256dh: json.keys?.p256dh || '',
      auth: json.keys?.auth || '',
    },
  };
}

export async function unsubscribeFromPush(): Promise<boolean> {
  try {
    // Only get existing subscription, don't create
    const subscription = await getExistingSubscription();
    if (!subscription) {
      notificationLogger.info('No subscription to unsubscribe');
      return true;
    }

    notificationLogger.info('Unsubscribing from push', { endpoint: subscription.endpoint });
    const success = await subscription.unsubscribe();
    notificationLogger.info('Unsubscribe result', { success });
    return success;
  } catch (error) {
    notificationLogger.error('Failed to unsubscribe', error);
    return false;
  }
}

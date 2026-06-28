import { notificationLogger } from '@/lib/logger';
import { VAPID_PUBLIC_KEY_ENV } from '@/lib/consent/constants';

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

function getVapidPublicKey(): string | null {
  const key = import.meta.env[VAPID_PUBLIC_KEY_ENV];
  if (!key) {
    notificationLogger.warn('VAPID public key not configured', { envVar: VAPID_PUBLIC_KEY_ENV });
    return null;
  }
  return key;
}

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
        endpoint: subscription.endpoint
      });
      return subscription;
    }

    // Create a new subscription
    const vapidKey = getVapidPublicKey();
    if (!vapidKey) {
      notificationLogger.error('Cannot subscribe: VAPID key missing');
      return null;
    }

    notificationLogger.info('Creating new push subscription');
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: vapidKey,
    });

    notificationLogger.info('Push subscription created', {
      endpoint: subscription.endpoint
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
    const subscription = await getPushSubscription();
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

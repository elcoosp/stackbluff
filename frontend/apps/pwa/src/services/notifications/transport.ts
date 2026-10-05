import {
  NOTIFICATIONS_SUBSCRIBE_ENDPOINT,
  NOTIFICATIONS_UNSUBSCRIBE_ENDPOINT,
} from '@/lib/consent/constants';
import { notificationLogger } from '@/lib/logger';

interface PushSubscriptionPayload {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}

export async function sendSubscriptionToBackend(
  subscription: PushSubscriptionPayload,
): Promise<boolean> {
  notificationLogger.info('Sending subscription to backend', {
    endpoint: subscription.endpoint,
  });

  try {
    const response = await fetch(NOTIFICATIONS_SUBSCRIBE_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      // F-7 FIX: the backend expects the flat shape `{ endpoint, keys }`
      // (see notification_routes::SubscribeRequest). We previously nested
      // it under `subscription`, which the deserializer rejected with 422.
      body: JSON.stringify({
        endpoint: subscription.endpoint,
        keys: subscription.keys,
        expiration_time: null,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      notificationLogger.error('Backend rejected subscription', {
        status: response.status,
        statusText: response.statusText,
        body: errorText,
      });
      return false;
    }

    notificationLogger.info('Subscription sent to backend successfully');
    return true;
  } catch (error) {
    notificationLogger.error('Failed to send subscription to backend', error);
    return false;
  }
}

export async function sendUnsubscribeToBackend(endpoint: string): Promise<boolean> {
  notificationLogger.info('Sending unsubscribe to backend', { endpoint });

  try {
    const response = await fetch(NOTIFICATIONS_UNSUBSCRIBE_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ endpoint }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      notificationLogger.error('Backend rejected unsubscribe', {
        status: response.status,
        statusText: response.statusText,
        body: errorText,
      });
      return false;
    }

    notificationLogger.info('Unsubscribe sent to backend successfully');
    return true;
  } catch (error) {
    notificationLogger.error('Failed to send unsubscribe to backend', error);
    return false;
  }
}

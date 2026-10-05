import { getToken } from '@stackbluff/shared/auth/token';

const API_BASE = '/api';

export function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

/**
 * F-7 FIX: this file is now the single source of truth for Web Push.
 * The previous implementation:
 *   * used a bare /notifications/... URL (missing the /api prefix),
 *   * sent no Authorization header (backend requires AuthUser),
 *   * POSTed the raw PushSubscription object, not the flat shape the
 *     backend expects (`{ endpoint, keys: { p256dh, auth } }`).
 * Combined with two other competing implementations in the repo, the
 * feature could never work. Delete/redirect those to import from here.
 */
export async function subscribeUserToPush(): Promise<boolean> {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    console.warn('Push messaging is not supported');
    return false;
  }

  try {
    const registration = await navigator.serviceWorker.ready;

    let subscription = await registration.pushManager.getSubscription();
    if (!subscription) {
      const response = await fetch(`${API_BASE}/notifications/vapid-public-key`);
      if (!response.ok) {
        throw new Error(`Failed to fetch VAPID public key: ${response.status}`);
      }
      const data = (await response.json()) as { public_key?: string };
      if (!data.public_key) {
        throw new Error('VAPID public key is empty');
      }

      const convertedVapidKey = urlBase64ToUint8Array(data.public_key);
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: convertedVapidKey as unknown as BufferSource,
      });
    }

    // Send the flat shape the backend expects.
    const json = subscription.toJSON();
    const token = getToken();
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers.Authorization = `Bearer ${token}`;

    const send = await fetch(`${API_BASE}/notifications/subscribe`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        endpoint: json.endpoint,
        keys: json.keys,
        expiration_time: null,
      }),
    });
    if (!send.ok) {
      console.warn('Push subscription rejected by backend', send.status);
      return false;
    }
    console.log('User subscribed to push notifications');
    return true;
  } catch (error) {
    console.error('Failed to subscribe user:', error);
    return false;
  }
}

export async function unsubscribeUserFromPush(): Promise<void> {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    return;
  }

  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();

    if (subscription) {
      await subscription.unsubscribe();
      const token = getToken();
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers.Authorization = `Bearer ${token}`;
      await fetch(`${API_BASE}/notifications/unsubscribe`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ endpoint: subscription.endpoint }),
      });
      console.log('User unsubscribed from push notifications');
    }
  } catch (error) {
    console.error('Failed to unsubscribe user:', error);
  }
}

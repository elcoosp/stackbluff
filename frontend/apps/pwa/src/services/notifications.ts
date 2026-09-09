export function isPushSupported(): boolean {
  return 'serviceWorker' in navigator && 'PushManager' in window;
}

export function getPermissionStatus(): NotificationPermission {
  if (!('Notification' in window)) return 'denied';
  return Notification.permission;
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

async function waitForServiceWorkerReady(
  timeoutMs = 5000,
): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) return null;
  try {
    const regPromise = navigator.serviceWorker.ready;
    const timeoutPromise = new Promise<ServiceWorkerRegistration | null>((resolve) =>
      setTimeout(() => resolve(null), timeoutMs),
    );
    return await Promise.race([regPromise, timeoutPromise]);
  } catch {
    return null;
  }
}

export async function subscribeToPushNotifications(): Promise<boolean> {
  if (!isPushSupported()) return false;
  try {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return false;

    const reg = await waitForServiceWorkerReady();
    if (!reg) {
      console.error('Service worker not ready in time');
      return false;
    }

    let subscription = await reg.pushManager.getSubscription();
    if (!subscription) {
      const res = await fetch('/notifications/vapid-public-key');
      const data = await res.json();
      if (!data.public_key) throw new Error('Missing VAPID key');

      const key = urlBase64ToUint8Array(data.public_key);
      subscription = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: key as unknown as BufferSource,
      });
    }

    const response = await fetch('/notifications/subscribe', {
      method: 'POST',
      body: JSON.stringify(subscription),
      headers: { 'Content-Type': 'application/json' },
    });

    return response.ok;
  } catch (e) {
    console.error('Failed to subscribe to push notifications', e);
    return false;
  }
}

export async function unsubscribeFromPushNotifications(): Promise<boolean> {
  if (!isPushSupported()) return false;
  try {
    const reg = await waitForServiceWorkerReady();
    if (!reg) return false;

    const subscription = await reg.pushManager.getSubscription();
    if (!subscription) return true; // Already unsubscribed

    // Unsubscribe locally first
    await subscription.unsubscribe();

    // Then notify backend
    const _response = await fetch('/notifications/unsubscribe', {
      method: 'POST',
      body: JSON.stringify({ endpoint: subscription.endpoint }),
      headers: { 'Content-Type': 'application/json' },
    });

    // Even if backend fails, we are locally unsubscribed.
    // The backend will clean up on next push attempt.
    return true;
  } catch (e) {
    console.error('Failed to unsubscribe from push notifications', e);
    return false;
  }
}

export async function resyncSubscription(): Promise<boolean> {
  if (!isPushSupported()) return false;
  try {
    const reg = await waitForServiceWorkerReady();
    if (!reg) return false;

    const subscription = await reg.pushManager.getSubscription();
    if (!subscription) return false;

    const response = await fetch('/notifications/subscribe', {
      method: 'POST',
      body: JSON.stringify(subscription),
      headers: { 'Content-Type': 'application/json' },
    });

    return response.ok;
  } catch (e) {
    console.error('Failed to resync subscription', e);
    return false;
  }
}

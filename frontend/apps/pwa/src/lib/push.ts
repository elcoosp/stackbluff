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

export async function subscribeUserToPush() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    console.warn('Push messaging is not supported');
    return;
  }

  try {
    const registration = await navigator.serviceWorker.ready;

    let subscription = await registration.pushManager.getSubscription();
    if (subscription) {
      console.log('User is already subscribed');
      return;
    }

    const response = await fetch('/notifications/vapid-public-key');
    if (!response.ok) {
      throw new Error('Failed to fetch VAPID public key');
    }
    const data = await response.json();
    const vapidPublicKey = data.public_key;

    if (!vapidPublicKey) {
      throw new Error('VAPID public key is empty');
    }

    const convertedVapidKey = urlBase64ToUint8Array(vapidPublicKey);
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: convertedVapidKey as unknown as BufferSource,
    });

    await fetch('/notifications/subscribe', {
      method: 'POST',
      body: JSON.stringify(subscription),
      headers: {
        'Content-Type': 'application/json',
      },
    });

    console.log('User subscribed to push notifications');
  } catch (error) {
    console.error('Failed to subscribe user:', error);
  }
}

export async function unsubscribeUserFromPush() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    return;
  }

  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();

    if (subscription) {
      await subscription.unsubscribe();
      await fetch('/notifications/unsubscribe', {
        method: 'POST',
        body: JSON.stringify({ endpoint: subscription.endpoint }),
        headers: {
          'Content-Type': 'application/json',
        },
      });
      console.log('User unsubscribed from push notifications');
    }
  } catch (error) {
    console.error('Failed to unsubscribe user:', error);
  }
}

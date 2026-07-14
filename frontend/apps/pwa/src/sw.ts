/// <reference lib="webworker" />
export {};

declare const self: ServiceWorkerGlobalScope;

// Inject manifest placeholder for vite-plugin-pwa
// @ts-ignore
self.__WB_MANIFEST;

self.addEventListener('push', (event) => {
  const data = event.data?.json() || {};
  const title = data.title || 'StackBluff Notification';
  const options: NotificationOptions = {
    body: data.body || '',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/badge-72x72.png',
    data: {
      url: data.url || '/'
    }
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(targetUrl) && 'focus' in client) {
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});

self.addEventListener('pushsubscriptionchange', (event) => {
  event.waitUntil(
    (async () => {
      try {
        const response = await fetch('/notifications/vapid-public-key');
        const data = await response.json();
        const vapidPublicKey = data.public_key;
        if (!vapidPublicKey) return;

        const padding = '='.repeat((4 - vapidPublicKey.length % 4) % 4);
        const base64 = (vapidPublicKey + padding).replace(/-/g, '+').replace(/_/g, '/');
        const rawData = atob(base64);
        const outputArray = new Uint8Array(rawData.length);
        for (let i = 0; i < rawData.length; ++i) {
          outputArray[i] = rawData.charCodeAt(i);
        }

        const newSubscription = await self.registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: outputArray as unknown as BufferSource
        });

        await fetch('/notifications/subscribe', {
          method: 'POST',
          body: JSON.stringify(newSubscription),
          headers: { 'Content-Type': 'application/json' }
        });
      } catch (error) {
        console.error('Failed to resubscribe:', error);
      }
    })()
  );
});

/**
 * Service worker registration and management utilities.
 */

/**
 * Register the service worker.
 * Should be called once during app initialization.
 */
export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    console.warn('Service workers not supported');
    return null;
  }

  try {
    const registration = await navigator.serviceWorker.register('/sw.js', {
      scope: '/',
    });

    console.log('[SW] Registered successfully:', registration.scope);

    // Check for updates periodically
    setInterval(() => {
      registration.update();
    }, 60 * 60 * 1000); // Every hour

    // Handle updates
    registration.addEventListener('updatefound', () => {
      const newWorker = registration.installing;
      if (!newWorker) return;

      newWorker.addEventListener('statechange', () => {
        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
          // New version available
          console.log('[SW] New version available');
          // Could show an update prompt here
        }
      });
    });

    return registration;
  } catch (error) {
    console.error('[SW] Registration failed:', error);
    return null;
  }
}

/**
 * Unregister the service worker.
 */
export async function unregisterServiceWorker(): Promise<boolean> {
  if (!('serviceWorker' in navigator)) return false;

  try {
    const registration = await navigator.serviceWorker.ready;
    const success = await registration.unregister();
    console.log('[SW] Unregistered:', success);
    return success;
  } catch (error) {
    console.error('[SW] Unregister failed:', error);
    return false;
  }
}

/**
 * Send a message to the service worker.
 */
export function sendMessageToSW(message: any): void {
  if (navigator.serviceWorker.controller) {
    navigator.serviceWorker.controller.postMessage(message);
  }
}

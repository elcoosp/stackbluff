import { logger } from '@/lib/logger';

const swLogger = logger.child({ component: 'serviceWorker' });

/**
 * Service worker registration and management utilities.
 * Uses Page Visibility API to pause updates when tab is hidden.
 */

let updateInterval: number | null = null;
let isTabVisible = true;

/**
 * Register the service worker.
 * Should be called once during app initialization.
 */
export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    swLogger.warn('Service workers not supported');
    return null;
  }

  swLogger.info('Registering service worker');

  try {
    const registration = await navigator.serviceWorker.register('/sw.js', {
      scope: '/',
    });

    swLogger.info('Service worker registered successfully', { scope: registration.scope });

    // Visibility-aware update interval
    // Only check for updates when tab is visible
    const startUpdateInterval = () => {
      if (updateInterval !== null) return;

      updateInterval = window.setInterval(
        () => {
          if (isTabVisible) {
            swLogger.debug('Checking for service worker updates');
            registration.update();
          }
        },
        60 * 60 * 1000,
      ); // Every hour
    };

    // Listen for visibility changes
    const handleVisibilityChange = () => {
      isTabVisible = !document.hidden;
      swLogger.debug('Tab visibility changed', { isTabVisible });

      if (isTabVisible) {
        // When tab becomes visible, check for updates immediately
        swLogger.debug('Tab visible, checking for updates');
        registration.update();
        startUpdateInterval();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    startUpdateInterval();

    // Handle updates
    registration.addEventListener('updatefound', () => {
      const newWorker = registration.installing;
      if (!newWorker) return;

      swLogger.info('Service worker update found');

      newWorker.addEventListener('statechange', () => {
        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
          swLogger.info('New service worker version available');
        }
      });
    });

    return registration;
  } catch (error) {
    swLogger.error('Service worker registration failed', error);
    return null;
  }
}

/**
 * Cleanup service worker resources.
 * Should be called when the app unmounts.
 */
export function cleanupServiceWorker(): void {
  if (updateInterval !== null) {
    swLogger.debug('Clearing service worker update interval');
    window.clearInterval(updateInterval);
    updateInterval = null;
  }
}

/**
 * Unregister the service worker.
 */
export async function unregisterServiceWorker(): Promise<boolean> {
  if (!('serviceWorker' in navigator)) return false;

  swLogger.info('Unregistering service worker');

  try {
    const registration = await navigator.serviceWorker.ready;
    const success = await registration.unregister();
    swLogger.info('Service worker unregistered', { success });
    return success;
  } catch (error) {
    swLogger.error('Service worker unregister failed', error);
    return false;
  }
}

/**
 * Send a message to the service worker.
 */
export function sendMessageToSW(message: any): void {
  if (navigator.serviceWorker.controller) {
    swLogger.debug('Sending message to service worker', message);
    navigator.serviceWorker.controller.postMessage(message);
  }
}

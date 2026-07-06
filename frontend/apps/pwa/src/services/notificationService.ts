import { useConsentStore, type NotificationConsent } from '@/stores/consentStore';

/**
 * Service for handling Web Push notifications.
 * Manages permission requests, subscription creation, and backend sync.
 */

interface PushSubscriptionJSON {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}

/**
 * Check if the browser supports Web Push notifications.
 */
export function isPushSupported(): boolean {
  if (typeof window === 'undefined') return false;
  if (!('Notification' in window)) return false;
  if (!('serviceWorker' in navigator)) return false;
  if (!('PushManager' in window)) return false;
  return true;
}

/**
 * Get the current notification permission status.
 */
export function getPermissionStatus(): NotificationPermission {
  if (!isPushSupported()) return 'denied';
  return Notification.permission;
}

/**
 * Request notification permission from the browser.
 * Returns the permission result.
 */
export async function requestPermission(): Promise<NotificationPermission> {
  if (!isPushSupported()) {
    console.warn('Push notifications not supported');
    return 'denied';
  }

  try {
    const permission = await Notification.requestPermission();

    // Update consent store
    const consent = permission as NotificationConsent;
    useConsentStore.getState().setNotificationConsent(consent);

    return permission;
  } catch (error) {
    console.error('Failed to request notification permission:', error);
    return 'denied';
  }
}

/**
 * Get or create a push subscription from the service worker.
 */
export async function getPushSubscription(): Promise<PushSubscription | null> {
  if (!isPushSupported()) {
    console.warn('Push notifications not supported');
    return null;
  }

  try {
    const registration = await navigator.serviceWorker.ready;
    let subscription = await registration.pushManager.getSubscription();

    if (!subscription) {
      // Create a new subscription
      // Note: The applicationServerKey should come from the backend
      // For now, we'll create without it (backend should handle this)
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        // applicationServerKey: process.env.VAPID_PUBLIC_KEY,
      });
    }

    return subscription;
  } catch (error) {
    console.error('Failed to get push subscription:', error);
    return null;
  }
}

/**
 * Convert a PushSubscription to JSON format for backend storage.
 */
export function subscriptionToJSON(subscription: PushSubscription): PushSubscriptionJSON {
  const keys = subscription.toJSON().keys;
  return {
    endpoint: subscription.endpoint,
    keys: {
      p256dh: keys?.p256dh || '',
      auth: keys?.auth || '',
    },
  };
}

/**
 * Send the push subscription to the backend for storage.
 * This calls POST /notifications/subscribe (implemented in #021).
 */
export async function sendSubscriptionToBackend(
  subscription: PushSubscription
): Promise<boolean> {
  try {
    const subscriptionJSON = subscriptionToJSON(subscription);

    // Get auth token from user store or session
    const token = localStorage.getItem('auth_token') || '';

    const response = await fetch('/api/notifications/subscribe', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token && { Authorization: `Bearer ${token}` }),
      },
      body: JSON.stringify({ subscription: subscriptionJSON }),
    });

    if (!response.ok) {
      throw new Error(`Failed to send subscription: ${response.statusText}`);
    }

    console.log('Push subscription sent to backend successfully');
    return true;
  } catch (error) {
    console.error('Failed to send subscription to backend:', error);
    return false;
  }
}

/**
 * Complete flow: request permission, get subscription, send to backend.
 * Returns true if successful.
 */
export async function subscribeToPushNotifications(): Promise<boolean> {
  if (!isPushSupported()) {
    console.warn('Push notifications not supported');
    return false;
  }

  // Request permission
  const permission = await requestPermission();
  if (permission !== 'granted') {
    console.log('Notification permission denied');
    return false;
  }

  // Get subscription
  const subscription = await getPushSubscription();
  if (!subscription) {
    console.error('Failed to get push subscription');
    return false;
  }

  // Send to backend
  const success = await sendSubscriptionToBackend(subscription);
  return success;
}

/**
 * Unsubscribe from push notifications.
 */
export async function unsubscribeFromPushNotifications(): Promise<boolean> {
  try {
    const subscription = await getPushSubscription();
    if (subscription) {
      await subscription.unsubscribe();
    }

    // Update consent store
    useConsentStore.getState().setNotificationConsent('default');

    return true;
  } catch (error) {
    console.error('Failed to unsubscribe:', error);
    return false;
  }
}

/**
 * Re-sync the current subscription with the backend.
 * Useful if the user switches browsers or devices.
 */
export async function resyncSubscription(): Promise<boolean> {
  const subscription = await getPushSubscription();
  if (!subscription) {
    return false;
  }
  return await sendSubscriptionToBackend(subscription);
}

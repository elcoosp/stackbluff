import { notificationLogger } from '@/lib/logger';

/**
 * Notification permission management.
 * Pure functions for checking and requesting browser permissions.
 */

export function isPushSupported(): boolean {
  if (typeof window === 'undefined') return false;
  if (!('Notification' in window)) {
    notificationLogger.debug('Notification API not available');
    return false;
  }
  if (!('serviceWorker' in navigator)) {
    notificationLogger.debug('Service Worker API not available');
    return false;
  }
  if (!('PushManager' in window)) {
    notificationLogger.debug('PushManager API not available');
    return false;
  }
  return true;
}

export function getPermissionStatus(): NotificationPermission {
  if (!isPushSupported()) return 'denied';
  return Notification.permission;
}

export async function requestPermission(): Promise<NotificationPermission> {
  if (!isPushSupported()) {
    notificationLogger.warn('Push notifications not supported');
    return 'denied';
  }

  notificationLogger.info('Requesting notification permission');

  try {
    const permission = await Notification.requestPermission();
    notificationLogger.info('Permission request result', { permission });
    return permission;
  } catch (error) {
    notificationLogger.error('Failed to request notification permission', error);
    return 'denied';
  }
}

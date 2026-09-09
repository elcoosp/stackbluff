import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useConsentStore } from '../stores/consentStore';

// Mock the apiClient
vi.mock('@stackbluff/shared/api/client', () => ({
  apiClient: {
    post: vi.fn().mockResolvedValue({ ok: true, status: 200 }),
  },
}));

// Mock VAPID key (valid 88-character base64url string)
vi.stubEnv(
  'VITE_VAPID_PUBLIC_KEY',
  'BPM1KZ9xH8Y8Z5Q3X2W1V0U9T8S7R6Q5P4O3N2M1L0K9J8I7H6G5F4E3D2C1B0A9Z8Y7X6W5V4U3T2S1R0Q9P8O7N6M5L4K3J2I1H0G9F8E7D6C5B4A3Z2Y1X0W9V8U7T6S5R4Q3P2O1N0M9L8K7J6I5H4G3F2E1D0C9B8A7Z6Y5X4W3V2U1T0S9R8Q7P6O5N4M3L2K1J0I9H8G7F6E5D4C3B2A1',
);

// Mock Notification API
const mockRequestPermission = vi.fn();
Object.defineProperty(window, 'Notification', {
  value: {
    permission: 'default',
    requestPermission: mockRequestPermission,
  },
  writable: true,
  configurable: true,
});

// Mock service worker
const mockSubscribe = vi.fn();
const mockGetSubscription = vi.fn();
const mockUnsubscribe = vi.fn();

Object.defineProperty(navigator, 'serviceWorker', {
  value: {
    ready: Promise.resolve({
      pushManager: {
        subscribe: mockSubscribe,
        getSubscription: mockGetSubscription,
      },
    }),
  },
  writable: true,
  configurable: true,
});

Object.defineProperty(window, 'PushManager', {
  value: class PushManager {},
  writable: true,
  configurable: true,
});

import { apiClient } from '@stackbluff/shared/api/client';
import {
  subscribeToPushNotifications,
  unsubscribeFromPushNotifications,
} from '../services/notifications';

describe('notificationService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useConsentStore.setState({
      notificationConsent: 'not_asked',
    });
    (window.Notification as any).permission = 'default';
    (apiClient.post as any).mockResolvedValue({ ok: true, status: 200 });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('subscribeToPushNotifications', () => {
    it('should request permission and subscribe with Uint8Array VAPID key', async () => {
      mockRequestPermission.mockResolvedValue('granted');
      mockGetSubscription.mockResolvedValue(null);
      mockSubscribe.mockResolvedValue({
        endpoint: 'https://example.com/push',
        toJSON: () => ({
          keys: { p256dh: 'test-key', auth: 'test-auth' },
        }),
      });

      const result = await subscribeToPushNotifications();

      expect(mockRequestPermission).toHaveBeenCalled();
      expect(mockSubscribe).toHaveBeenCalled();

      // Verify applicationServerKey is Uint8Array, not string
      const subscribeCall = mockSubscribe.mock.calls[0][0];
      expect(subscribeCall.applicationServerKey).toBeInstanceOf(Uint8Array);

      expect(apiClient.post).toHaveBeenCalled();
      expect(result).toBe(true);
      expect(useConsentStore.getState().notificationConsent).toBe('granted');
    });

    it('should not subscribe when permission denied', async () => {
      mockRequestPermission.mockResolvedValue('denied');

      const result = await subscribeToPushNotifications();

      expect(mockRequestPermission).toHaveBeenCalled();
      expect(mockSubscribe).not.toHaveBeenCalled();
      expect(result).toBe(false);
      expect(useConsentStore.getState().notificationConsent).toBe('denied');
    });

    it('should use existing subscription if available', async () => {
      mockRequestPermission.mockResolvedValue('granted');
      const existingSubscription = {
        endpoint: 'https://example.com/existing',
        toJSON: () => ({
          keys: { p256dh: 'existing-key', auth: 'existing-auth' },
        }),
      };
      mockGetSubscription.mockResolvedValue(existingSubscription);

      const result = await subscribeToPushNotifications();

      expect(mockGetSubscription).toHaveBeenCalled();
      expect(mockSubscribe).not.toHaveBeenCalled();
      expect(apiClient.post).toHaveBeenCalled();
      expect(result).toBe(true);
    });

    it('should return false when VAPID key is invalid', async () => {
      vi.stubEnv('VITE_VAPID_PUBLIC_KEY', '');

      mockRequestPermission.mockResolvedValue('granted');
      mockGetSubscription.mockResolvedValue(null);

      const result = await subscribeToPushNotifications();

      expect(result).toBe(false);
      expect(mockSubscribe).not.toHaveBeenCalled();
    });

    it('should return false when backend call fails', async () => {
      mockRequestPermission.mockResolvedValue('granted');
      mockGetSubscription.mockResolvedValue(null);
      mockSubscribe.mockResolvedValue({
        endpoint: 'https://example.com/push',
        toJSON: () => ({
          keys: { p256dh: 'test-key', auth: 'test-auth' },
        }),
      });

      (apiClient.post as any).mockResolvedValue({ ok: false, status: 500 });

      const result = await subscribeToPushNotifications();

      expect(result).toBe(false);
    });
  });

  describe('unsubscribeFromPushNotifications', () => {
    it('should unsubscribe from push notifications', async () => {
      const subscription = {
        endpoint: 'https://example.com/push',
        unsubscribe: mockUnsubscribe.mockResolvedValue(true),
      };
      mockGetSubscription.mockResolvedValue(subscription);

      const result = await unsubscribeFromPushNotifications();

      expect(mockUnsubscribe).toHaveBeenCalled();
      expect(result).toBe(true);
      expect(useConsentStore.getState().notificationConsent).toBe('default');
    });

    it('should handle no subscription gracefully', async () => {
      mockGetSubscription.mockResolvedValue(null);

      const result = await unsubscribeFromPushNotifications();

      expect(mockUnsubscribe).not.toHaveBeenCalled();
      expect(result).toBe(true);
    });
  });
});

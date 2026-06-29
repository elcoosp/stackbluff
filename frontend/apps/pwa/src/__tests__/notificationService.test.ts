import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useConsentStore } from '../stores/consentStore';

// Mock the apiClient before importing the service
vi.mock('@stackbluff/shared/api/client', () => ({
  apiClient: {
    post: vi.fn().mockResolvedValue({ ok: true }),
  },
}));

// Mock environment variables
vi.stubEnv('VITE_VAPID_PUBLIC_KEY', 'test-vapid-public-key');

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

// Mock PushManager
Object.defineProperty(window, 'PushManager', {
  value: class PushManager {},
  writable: true,
  configurable: true,
});

// Import after mocks are set up
import { subscribeToPushNotifications, unsubscribeFromPushNotifications } from '../services/notifications';
import { apiClient } from '@stackbluff/shared/api/client';

describe('notificationService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useConsentStore.setState({
      notificationConsent: 'not_asked',
    });
    (window.Notification as any).permission = 'default';

    // Reset apiClient mock
    (apiClient.post as any).mockResolvedValue({ ok: true });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('subscribeToPushNotifications', () => {
    it('should request permission and subscribe when allowed', async () => {
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

    it('should return false when backend call fails', async () => {
      mockRequestPermission.mockResolvedValue('granted');
      mockGetSubscription.mockResolvedValue(null);
      mockSubscribe.mockResolvedValue({
        endpoint: 'https://example.com/push',
        toJSON: () => ({
          keys: { p256dh: 'test-key', auth: 'test-auth' },
        }),
      });

      // Mock backend failure
      (apiClient.post as any).mockResolvedValue({ ok: false, status: 500, statusText: 'Internal Server Error', text: () => Promise.resolve('Error') });

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
      // Mock: no existing subscription
      mockGetSubscription.mockResolvedValue(null);

      const result = await unsubscribeFromPushNotifications();

      // Should not try to unsubscribe since there's no subscription
      expect(mockUnsubscribe).not.toHaveBeenCalled();
      // Should return true (success - nothing to unsubscribe from)
      expect(result).toBe(true);
      // Should update consent store
      expect(useConsentStore.getState().notificationConsent).toBe('default');
    });
  });
});

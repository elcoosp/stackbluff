import { describe, it, expect, beforeEach, vi } from 'vitest';
import { subscribeToPushNotifications } from '../services/notifications';
import { useConsentStore } from '../stores/consentStore';

// Mock Notification API
const mockRequestPermission = vi.fn();
Object.defineProperty(window, 'Notification', {
  value: {
    permission: 'default',
    requestPermission: mockRequestPermission,
  },
  writable: true,
});

// Mock service worker
const mockSubscribe = vi.fn();
const mockGetSubscription = vi.fn();
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
});

describe('notificationService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useConsentStore.setState({
      notificationConsent: 'not_asked',
    });
  });

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
});

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useConsentStore } from '../stores/consentStore';

vi.mock('@/lib/analytics', () => ({
  trackEvent: vi.fn(),
}));

vi.mock('../services/notifications/permission', () => ({
  isPushSupported: vi.fn(),
  getPermissionStatus: vi.fn(),
  requestPermission: vi.fn(),
}));

vi.mock('../services/notifications/subscription', () => ({
  getExistingSubscription: vi.fn(),
  getPushSubscription: vi.fn(),
  subscriptionToJSON: vi.fn(),
  unsubscribeFromPush: vi.fn(),
}));

vi.mock('../services/notifications/transport', () => ({
  sendSubscriptionToBackend: vi.fn(),
}));

import { trackEvent } from '@/lib/analytics';
import {
  ANALYTICS_NOTIFICATION_ALLOWED,
  ANALYTICS_NOTIFICATION_DENIED,
  ANALYTICS_NOTIFICATION_SUBSCRIBED,
  ANALYTICS_NOTIFICATION_UNSUBSCRIBED,
} from '@/lib/consent/constants';
import {
  getPermissionStatus,
  resyncSubscription,
  subscribeToPushNotifications,
  unsubscribeFromPushNotifications,
} from '../services/notifications';
import { isPushSupported, requestPermission } from '../services/notifications/permission';
import {
  getPushSubscription,
  subscriptionToJSON,
  unsubscribeFromPush,
} from '../services/notifications/subscription';
import { sendSubscriptionToBackend } from '../services/notifications/transport';

const mockIsPushSupported = vi.mocked(isPushSupported);
const mockGetPermissionStatus = vi.mocked(getPermissionStatus);
const mockRequestPermission = vi.mocked(requestPermission);
const mockGetPushSubscription = vi.mocked(getPushSubscription);
const mockSubscriptionToJSON = vi.mocked(subscriptionToJSON);
const mockUnsubscribeFromPush = vi.mocked(unsubscribeFromPush);
const mockSendSubscriptionToBackend = vi.mocked(sendSubscriptionToBackend);

describe('notificationService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useConsentStore.setState({
      notificationConsent: 'not_asked',
      notificationPromptDismissedAt: null,
    });
    mockIsPushSupported.mockReturnValue(true);
  });

  describe('subscribeToPushNotifications', () => {
    it('returns false when push not supported', async () => {
      mockIsPushSupported.mockReturnValue(false);

      const result = await subscribeToPushNotifications();

      expect(result).toBe(false);
      expect(mockRequestPermission).not.toHaveBeenCalled();
    });

    it('returns false and denies consent when permission is not granted', async () => {
      mockRequestPermission.mockResolvedValue('denied');

      const result = await subscribeToPushNotifications();

      expect(result).toBe(false);
      expect(mockRequestPermission).toHaveBeenCalled();
      expect(useConsentStore.getState().notificationConsent).toBe('denied');
      expect(trackEvent).toHaveBeenCalledWith(ANALYTICS_NOTIFICATION_DENIED, {
        props: { reason: 'permission_denied' },
      });
    });

    it('returns false when getPushSubscription returns null', async () => {
      mockRequestPermission.mockResolvedValue('granted');
      mockGetPushSubscription.mockResolvedValue(null);

      const result = await subscribeToPushNotifications();

      expect(result).toBe(false);
      expect(mockRequestPermission).toHaveBeenCalled();
      expect(useConsentStore.getState().notificationConsent).toBe('granted');
    });

    it('returns true when subscription is sent to backend successfully', async () => {
      mockRequestPermission.mockResolvedValue('granted');
      const fakeSub = { endpoint: 'https://example.com/push' } as PushSubscription;
      mockGetPushSubscription.mockResolvedValue(fakeSub);
      const fakeJSON = { endpoint: 'https://example.com/push', keys: { p256dh: 'k', auth: 'a' } };
      mockSubscriptionToJSON.mockReturnValue(fakeJSON);
      mockSendSubscriptionToBackend.mockResolvedValue(true);

      const result = await subscribeToPushNotifications();

      expect(result).toBe(true);
      expect(useConsentStore.getState().notificationConsent).toBe('granted');
      expect(trackEvent).toHaveBeenCalledWith(ANALYTICS_NOTIFICATION_ALLOWED);
      expect(trackEvent).toHaveBeenCalledWith(ANALYTICS_NOTIFICATION_SUBSCRIBED);
      expect(mockSubscriptionToJSON).toHaveBeenCalledWith(fakeSub);
      expect(mockSendSubscriptionToBackend).toHaveBeenCalledWith(fakeJSON);
    });

    it('returns false when backend rejects subscription', async () => {
      mockRequestPermission.mockResolvedValue('granted');
      const fakeSub = { endpoint: 'https://example.com/push' } as PushSubscription;
      mockGetPushSubscription.mockResolvedValue(fakeSub);
      mockSubscriptionToJSON.mockReturnValue({
        endpoint: 'https://example.com/push',
        keys: { p256dh: 'k', auth: 'a' },
      });
      mockSendSubscriptionToBackend.mockResolvedValue(false);

      const result = await subscribeToPushNotifications();

      expect(result).toBe(false);
      expect(trackEvent).not.toHaveBeenCalledWith(ANALYTICS_NOTIFICATION_SUBSCRIBED);
    });
  });

  describe('unsubscribeFromPushNotifications', () => {
    it('returns true and updates consent when browser unsubscribe succeeds', async () => {
      mockUnsubscribeFromPush.mockResolvedValue(true);

      const result = await unsubscribeFromPushNotifications();

      expect(result).toBe(true);
      expect(mockUnsubscribeFromPush).toHaveBeenCalled();
      expect(useConsentStore.getState().notificationConsent).toBe('default');
      expect(trackEvent).toHaveBeenCalledWith(ANALYTICS_NOTIFICATION_UNSUBSCRIBED);
    });

    it('returns false when browser unsubscribe fails', async () => {
      mockUnsubscribeFromPush.mockResolvedValue(false);

      const result = await unsubscribeFromPushNotifications();

      expect(result).toBe(false);
      expect(useConsentStore.getState().notificationConsent).toBe('not_asked');
      expect(trackEvent).not.toHaveBeenCalled();
    });
  });

  describe('resyncSubscription', () => {
    it('returns false when no existing subscription', async () => {
      mockGetPushSubscription.mockResolvedValue(null);

      const result = await resyncSubscription();

      expect(result).toBe(false);
    });

    it('returns true when backend accepts resync', async () => {
      const fakeSub = { endpoint: 'https://example.com/push' } as PushSubscription;
      mockGetPushSubscription.mockResolvedValue(fakeSub);
      mockSubscriptionToJSON.mockReturnValue({
        endpoint: 'https://example.com/push',
        keys: { p256dh: 'k', auth: 'a' },
      });
      mockSendSubscriptionToBackend.mockResolvedValue(true);

      const result = await resyncSubscription();

      expect(result).toBe(true);
    });

    it('returns false when backend rejects resync', async () => {
      const fakeSub = { endpoint: 'https://example.com/push' } as PushSubscription;
      mockGetPushSubscription.mockResolvedValue(fakeSub);
      mockSubscriptionToJSON.mockReturnValue({
        endpoint: 'https://example.com/push',
        keys: { p256dh: 'k', auth: 'a' },
      });
      mockSendSubscriptionToBackend.mockResolvedValue(false);

      const result = await resyncSubscription();

      expect(result).toBe(false);
    });
  });

  describe('getPermissionStatus', () => {
    it('returns denied when push is not supported', async () => {
      mockGetPermissionStatus.mockReturnValue('denied');

      const status = getPermissionStatus();

      expect(status).toBe('denied');
      expect(mockIsPushSupported).not.toHaveBeenCalled();
    });
  });
});

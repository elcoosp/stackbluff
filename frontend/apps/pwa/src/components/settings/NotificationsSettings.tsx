import { useState, useEffect } from 'react';
import { useConsentStore } from '@/stores/consentStore';
import {
  isPushSupported,
  getPermissionStatus,
  subscribeToPushNotifications,
  unsubscribeFromPushNotifications,
  resyncSubscription,
} from '@/services/notifications';
import { notificationLogger } from '@/lib/logger';

const logger = notificationLogger.child({ component: 'NotificationsSettings' });

type PermissionDisplay = 'enabled' | 'blocked' | 'not_set' | 'unsupported';

function getPermissionDisplay(): PermissionDisplay {
  if (!isPushSupported()) return 'unsupported';
  const permission = getPermissionStatus();
  if (permission === 'granted') return 'enabled';
  if (permission === 'denied') return 'blocked';
  return 'not_set';
}

/**
 * Notifications settings section for the settings page.
 * Uses Tailwind CSS (no inline styles).
 */
export function NotificationsSettings() {
  const [permissionDisplay, setPermissionDisplay] = useState<PermissionDisplay>(
    getPermissionDisplay()
  );
  const [isProcessing, setIsProcessing] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(
    null
  );

  const notificationConsent = useConsentStore((s) => s.notificationConsent);

  // Refresh status on mount and when consent changes
  useEffect(() => {
    setPermissionDisplay(getPermissionDisplay());
  }, [notificationConsent]);

  const isEnabled = permissionDisplay === 'enabled';
  const isBlocked = permissionDisplay === 'blocked';
  const isUnsupported = permissionDisplay === 'unsupported';

  const handleToggle = async () => {
    setIsProcessing(true);
    setMessage(null);

    try {
      if (isEnabled) {
        logger.info('Disabling notifications');
        const success = await unsubscribeFromPushNotifications();
        if (success) {
          setPermissionDisplay('not_set');
          setMessage({ type: 'success', text: 'Notifications disabled.' });
        } else {
          setMessage({ type: 'error', text: 'Failed to disable notifications.' });
        }
      } else if (isBlocked) {
        logger.warn('Cannot enable: blocked in browser settings');
        setMessage({
          type: 'error',
          text:
            'Notifications are blocked in your browser settings. Please enable them in your browser and try again.',
        });
      } else {
        logger.info('Enabling notifications');
        const success = await subscribeToPushNotifications();
        if (success) {
          setPermissionDisplay('enabled');
          setMessage({ type: 'success', text: 'Notifications enabled!' });
        } else {
          setPermissionDisplay(getPermissionDisplay());
          setMessage({
            type: 'error',
            text: 'Failed to enable notifications. Permission may have been denied.',
          });
        }
      }
    } catch (error) {
      logger.error('Toggle failed', error);
      setMessage({ type: 'error', text: 'An error occurred. Please try again.' });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleResync = async () => {
    setIsProcessing(true);
    setMessage(null);

    try {
      logger.info('Resyncing subscription');
      const success = await resyncSubscription();
      if (success) {
        setMessage({ type: 'success', text: 'Subscription synced successfully.' });
      } else {
        setMessage({ type: 'error', text: 'Failed to sync subscription.' });
      }
    } catch (error) {
      logger.error('Resync failed', error);
      setMessage({ type: 'error', text: 'An error occurred while syncing.' });
    } finally {
      setIsProcessing(false);
    }
  };

  const statusLabel = {
    enabled: '✅ Enabled',
    blocked: '🚫 Blocked',
    not_set: '⚪ Not set',
    unsupported: '⚠️ Not supported',
  }[permissionDisplay];

  const statusColorClass = {
    enabled: 'bg-green-500/20 text-green-400',
    blocked: 'bg-red-500/20 text-red-400',
    not_set: 'bg-white/10 text-white/80',
    unsupported: 'bg-yellow-500/20 text-yellow-400',
  }[permissionDisplay];

  return (
    <section className="p-6 rounded-xl bg-white/5 border border-white/10">
      <h3 className="text-lg font-semibold mb-2">
        🔔 Notifications
      </h3>
      <p className="text-sm text-gray-400 mb-4">
        Receive tournament reminders, streak alerts, and game updates.
      </p>

      {/* Status */}
      <div className="flex items-center justify-between mb-4">
        <span className="text-sm">Status:</span>
        <span className={`text-sm font-medium px-3 py-1 rounded-full ${statusColorClass}`}>
          {statusLabel}
        </span>
      </div>

      {/* Toggle button */}
      {!isUnsupported && (
        <button
          type="button"
          onClick={handleToggle}
          disabled={isProcessing}
          data-testid="notifications-toggle"
          className={`w-full px-4 py-3 rounded-lg border-none text-white text-sm font-semibold transition-colors disabled:opacity-60 disabled:cursor-not-allowed mb-3 ${
            isEnabled
              ? 'bg-red-500 hover:bg-red-600'
              : 'bg-blue-500 hover:bg-blue-600'
          }`}
        >
          {isProcessing
            ? 'Processing...'
            : isEnabled
              ? 'Disable Notifications'
              : isBlocked
                ? 'Enable in Browser Settings'
                : 'Enable Notifications'}
        </button>
      )}

      {/* Resync button (only if enabled) */}
      {isEnabled && (
        <button
          type="button"
          onClick={handleResync}
          disabled={isProcessing}
          data-testid="notifications-resync"
          className="w-full px-4 py-2.5 rounded-lg border border-white/20 bg-transparent text-white text-sm font-medium hover:bg-white/10 transition-colors disabled:opacity-60 disabled:cursor-not-allowed mb-3"
        >
          🔄 Re-sync Subscription
        </button>
      )}

      {/* Blocked help text */}
      {isBlocked && (
        <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-xs leading-relaxed mb-3">
          <strong>How to enable:</strong>
          <br />
          Click the lock/info icon in your browser&apos;s address bar → Site settings →
          Notifications → Allow
        </div>
      )}

      {/* Unsupported message */}
      {isUnsupported && (
        <div className="p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/30 text-xs leading-relaxed">
          Push notifications are not supported in this browser. Try using Chrome, Firefox, or
          Safari 16.4+.
        </div>
      )}

      {/* Message feedback */}
      {message && (
        <div
          className={`mt-3 p-2.5 px-3 rounded text-xs ${
            message.type === 'success'
              ? 'bg-green-500/15 text-green-400'
              : 'bg-red-500/15 text-red-400'
          }`}
          data-testid="notifications-message"
        >
          {message.text}
        </div>
      )}
    </section>
  );
}

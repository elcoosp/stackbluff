import { useState, useEffect } from 'react';
import { useConsentStore, type NotificationConsent } from '@/stores/consentStore';
import {
  isPushSupported,
  getPermissionStatus,
  subscribeToPushNotifications,
  unsubscribeFromPushNotifications,
  resyncSubscription,
} from '@/services/notificationService';

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
 * Allows users to view status, enable/disable, and re-sync subscriptions.
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
  const setNotificationConsent = useConsentStore((s) => s.setNotificationConsent);

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
        // Disable notifications
        const success = await unsubscribeFromPushNotifications();
        if (success) {
          setNotificationConsent('default');
          setPermissionDisplay('not_set');
          setMessage({ type: 'success', text: 'Notifications disabled.' });
        } else {
          setMessage({ type: 'error', text: 'Failed to disable notifications.' });
        }
      } else if (isBlocked) {
        // Can't enable from here - user must change browser settings
        setMessage({
          type: 'error',
          text:
            'Notifications are blocked in your browser settings. Please enable them in your browser and try again.',
        });
      } else {
        // Enable notifications
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
      setMessage({ type: 'error', text: 'An error occurred. Please try again.' });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleResync = async () => {
    setIsProcessing(true);
    setMessage(null);

    try {
      const success = await resyncSubscription();
      if (success) {
        setMessage({ type: 'success', text: 'Subscription synced successfully.' });
      } else {
        setMessage({ type: 'error', text: 'Failed to sync subscription.' });
      }
    } catch (error) {
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

  return (
    <section
      style={{
        padding: '1.5rem',
        borderRadius: '0.75rem',
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
      }}
    >
      <h3
        style={{
          margin: '0 0 0.5rem 0',
          fontSize: '1.125rem',
          fontWeight: 600,
        }}
      >
        🔔 Notifications
      </h3>
      <p
        style={{
          margin: '0 0 1rem 0',
          fontSize: '0.875rem',
          color: '#888',
        }}
      >
        Receive tournament reminders, streak alerts, and game updates.
      </p>

      {/* Status */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '1rem',
        }}
      >
        <span style={{ fontSize: '0.875rem' }}>Status:</span>
        <span
          style={{
            fontSize: '0.875rem',
            fontWeight: 500,
            padding: '0.25rem 0.75rem',
            borderRadius: '9999px',
            backgroundColor: isEnabled
              ? 'rgba(34, 197, 94, 0.2)'
              : isBlocked
                ? 'rgba(239, 68, 68, 0.2)'
                : 'rgba(255, 255, 255, 0.1)',
          }}
        >
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
          style={{
            width: '100%',
            padding: '0.75rem 1rem',
            borderRadius: '0.5rem',
            border: 'none',
            backgroundColor: isEnabled ? '#ef4444' : '#3b82f6',
            color: '#fff',
            cursor: isProcessing ? 'not-allowed' : 'pointer',
            fontSize: '0.875rem',
            fontWeight: 600,
            opacity: isProcessing ? 0.6 : 1,
            marginBottom: '0.75rem',
          }}
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
          style={{
            width: '100%',
            padding: '0.625rem 1rem',
            borderRadius: '0.5rem',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            backgroundColor: 'transparent',
            color: '#fff',
            cursor: isProcessing ? 'not-allowed' : 'pointer',
            fontSize: '0.8125rem',
            fontWeight: 500,
            opacity: isProcessing ? 0.6 : 1,
            marginBottom: '0.75rem',
          }}
        >
          🔄 Re-sync Subscription
        </button>
      )}

      {/* Blocked help text */}
      {isBlocked && (
        <div
          style={{
            padding: '0.75rem',
            borderRadius: '0.5rem',
            backgroundColor: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            fontSize: '0.8125rem',
            lineHeight: 1.5,
            marginBottom: '0.75rem',
          }}
        >
          <strong>How to enable:</strong>
          <br />
          Click the lock/info icon in your browser&apos;s address bar → Site settings →
          Notifications → Allow
        </div>
      )}

      {/* Unsupported message */}
      {isUnsupported && (
        <div
          style={{
            padding: '0.75rem',
            borderRadius: '0.5rem',
            backgroundColor: 'rgba(251, 191, 36, 0.1)',
            border: '1px solid rgba(251, 191, 36, 0.3)',
            fontSize: '0.8125rem',
            lineHeight: 1.5,
          }}
        >
          Push notifications are not supported in this browser. Try using Chrome, Firefox, or
          Safari 16.4+.
        </div>
      )}

      {/* Message feedback */}
      {message && (
        <div
          style={{
            marginTop: '0.75rem',
            padding: '0.625rem 0.75rem',
            borderRadius: '0.375rem',
            fontSize: '0.8125rem',
            backgroundColor:
              message.type === 'success'
                ? 'rgba(34, 197, 94, 0.15)'
                : 'rgba(239, 68, 68, 0.15)',
            color: message.type === 'success' ? '#4ade80' : '#f87171',
          }}
          data-testid="notifications-message"
        >
          {message.text}
        </div>
      )}
    </section>
  );
}

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useConsentStore } from '@/stores/consentStore';
import {
  isPushSupported,
  getPermissionStatus,
  subscribeToPushNotifications,
  unsubscribeFromPushNotifications,
  resyncSubscription,
} from '@/services/notifications';
import { notificationLogger } from '@/lib/logger';
import { StatusBadge } from './notifications/StatusBadge';
import { ToggleButton } from './notifications/ToggleButton';
import { ResyncButton } from './notifications/ResyncButton';
import { BlockedHelp } from './notifications/BlockedHelp';
import { UnsupportedMessage } from './notifications/UnsupportedMessage';
import { MessageFeedback } from './notifications/MessageFeedback';
import type { PermissionDisplay } from './notifications/types';

const logger = notificationLogger.child({ component: 'NotificationsSettings' });

// Memoize feature detection
const pushSupported = typeof window !== 'undefined' && isPushSupported();

function getPermissionDisplay(): PermissionDisplay {
  if (!pushSupported) return 'unsupported';
  const permission = getPermissionStatus();
  if (permission === 'granted') return 'enabled';
  if (permission === 'denied') return 'blocked';
  return 'not_set';
}

/**
 * Notifications settings section for the settings page.
 * Composed of focused sub-components for maintainability.
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

  // Refresh status when consent changes
  useEffect(() => {
    setPermissionDisplay(getPermissionDisplay());
  }, [notificationConsent]);

  const isEnabled = permissionDisplay === 'enabled';
  const isBlocked = permissionDisplay === 'blocked';
  const isUnsupported = permissionDisplay === 'unsupported';

  const handleToggle = useCallback(async () => {
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
          text: 'Notifications are blocked in your browser settings. Please enable them in your browser and try again.',
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
  }, [isEnabled, isBlocked]);

  const handleResync = useCallback(async () => {
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
  }, []);

  return (
    <section className="p-6 rounded-xl bg-white/5 border border-white/10">
      <h3 className="text-lg font-semibold mb-2">🔔 Notifications</h3>
      <p className="text-sm text-gray-400 mb-4">
        Receive tournament reminders, streak alerts, and game updates.
      </p>

      {/* Status */}
      <div className="flex items-center justify-between mb-4">
        <span className="text-sm">Status:</span>
        <StatusBadge status={permissionDisplay} />
      </div>

      {/* Toggle */}
      <ToggleButton
        status={permissionDisplay}
        isProcessing={isProcessing}
        onClick={handleToggle}
      />

      {/* Resync (only if enabled) */}
      {isEnabled && (
        <ResyncButton isProcessing={isProcessing} onClick={handleResync} />
      )}

      {/* Contextual help */}
      {isBlocked && <BlockedHelp />}
      {isUnsupported && <UnsupportedMessage />}

      {/* Feedback */}
      <MessageFeedback message={message} />
    </section>
  );
}

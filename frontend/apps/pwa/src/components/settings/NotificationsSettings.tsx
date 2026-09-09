import { t } from '@lingui/core/macro';
import { Trans } from '@lingui/react/macro';
import { Bell } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { notificationLogger } from '@/lib/logger';
import {
  getPermissionStatus,
  isPushSupported,
  resyncSubscription,
  subscribeToPushNotifications,
  unsubscribeFromPushNotifications,
} from '@/services/notifications';
import { useConsentStore } from '@/stores/consentStore';
import { BlockedHelp } from './notifications/BlockedHelp';
import { MessageFeedback } from './notifications/MessageFeedback';
import { ResyncButton } from './notifications/ResyncButton';
import { StatusBadge } from './notifications/StatusBadge';
import { ToggleButton } from './notifications/ToggleButton';
import type { PermissionDisplay } from './notifications/types';
import { UnsupportedMessage } from './notifications/UnsupportedMessage';

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
    getPermissionDisplay(),
  );
  const [isProcessing, setIsProcessing] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const _notificationConsent = useConsentStore((s) => s.notificationConsent);

  // Refresh status when consent changes
  useEffect(() => {
    setPermissionDisplay(getPermissionDisplay());
  }, []);

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
          setMessage({ type: 'success', text: t`Notifications disabled.` });
        } else {
          setMessage({ type: 'error', text: t`Failed to disable notifications.` });
        }
      } else if (isBlocked) {
        logger.warn('Cannot enable: blocked in browser settings');
        setMessage({
          type: 'error',
          text: t`Notifications are blocked in your browser settings. Please enable them in your browser and try again.`,
        });
      } else {
        logger.info('Enabling notifications');
        const success = await subscribeToPushNotifications();
        if (success) {
          setPermissionDisplay('enabled');
          setMessage({ type: 'success', text: t`Notifications enabled!` });
        } else {
          setPermissionDisplay(getPermissionDisplay());
          setMessage({
            type: 'error',
            text: t`Failed to enable notifications. Permission may have been denied.`,
          });
        }
      }
    } catch (error) {
      logger.error('Toggle failed', error);
      setMessage({ type: 'error', text: t`An error occurred. Please try again.` });
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
        setMessage({ type: 'success', text: t`Subscription synced successfully.` });
      } else {
        setMessage({ type: 'error', text: t`Failed to sync subscription.` });
      }
    } catch (error) {
      logger.error('Resync failed', error);
      setMessage({ type: 'error', text: t`An error occurred while syncing.` });
    } finally {
      setIsProcessing(false);
    }
  }, []);

  return (
    <section className="p-6 rounded-xl bg-white/5 border border-white/10">
      <h3 className="text-lg font-semibold mb-2 flex items-center gap-2">
        <Bell className="w-5 h-5 text-tertiary" />
        <Trans>Notifications</Trans>
      </h3>
      <p className="text-sm text-gray-400 mb-4">
        <Trans>Receive tournament reminders, streak alerts, and game updates.</Trans>
      </p>

      {/* Status */}
      <div className="flex items-center justify-between mb-4">
        <span className="text-sm">
          <Trans>Status:</Trans>
        </span>
        <StatusBadge status={permissionDisplay} />
      </div>

      {/* Toggle */}
      <ToggleButton status={permissionDisplay} isProcessing={isProcessing} onClick={handleToggle} />

      {/* Resync (only if enabled) */}
      {isEnabled && <ResyncButton isProcessing={isProcessing} onClick={handleResync} />}

      {/* Contextual help */}
      {isBlocked && <BlockedHelp />}
      {isUnsupported && <UnsupportedMessage />}

      {/* Feedback */}
      <MessageFeedback message={message} />
    </section>
  );
}

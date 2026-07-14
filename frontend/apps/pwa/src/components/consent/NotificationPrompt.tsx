import { useState, useEffect, useMemo, useCallback } from 'react';
import { useConsentStore } from '@/stores/consentStore';
import { isPushSupported, subscribeToPushNotifications } from '@/services/notifications';
import { consentLogger } from '@/lib/logger';
import { useInterval } from '@/hooks/useInterval';
import { FIRST_HAND_PLAYED_KEY, MAYBE_LATER_COOLDOWN_MS } from '@/lib/consent/constants';
import { Trans } from '@lingui/react/macro';
import { t } from '@lingui/core/macro';

interface NotificationPromptProps {
  onDecision?: (decision: 'allowed' | 'denied' | 'later') => void;
}

// Memoize feature detection - it doesn't change during runtime
const pushSupported = typeof window !== 'undefined' && isPushSupported();

/**
 * Non-intrusive notification permission prompt.
 * Uses reactive cooldown: checks every minute if cooldown has expired.
 */
export function NotificationPrompt({ onDecision }: NotificationPromptProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [, forceUpdate] = useState(0); // Force re-render for cooldown check

  const canShowPrompt = useConsentStore((s) => s.canShowNotificationPrompt());
  const dismissPrompt = useConsentStore((s) => s.dismissNotificationPrompt);
  const setNotificationConsent = useConsentStore((s) => s.setNotificationConsent);
  const notificationPromptDismissedAt = useConsentStore((s) => s.notificationPromptDismissedAt);

  // Check if first hand has been played
  const hasPlayedFirstHand = useMemo(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem(FIRST_HAND_PLAYED_KEY) === 'true';
  }, []);

  // Reactive cooldown: check every 60 seconds if we should show the prompt
  // Only active if there's a dismissed timestamp and cooldown hasn't expired
  const shouldCheckCooldown = notificationPromptDismissedAt !== null;
  useInterval(
    useCallback(() => {
      if (notificationPromptDismissedAt) {
        const elapsed = Date.now() - notificationPromptDismissedAt;
        if (elapsed >= MAYBE_LATER_COOLDOWN_MS) {
          consentLogger.info('Cooldown expired, re-evaluating prompt visibility');
          forceUpdate((n) => n + 1);
        }
      }
    }, [notificationPromptDismissedAt]),
    shouldCheckCooldown ? 60_000 : null // Check every minute, null to disable
  );

  // Unified visibility: only show if all conditions are met
  const isVisible = pushSupported && canShowPrompt && hasPlayedFirstHand;

  useEffect(() => {
    if (isVisible) {
      consentLogger.info('Notification prompt shown');
    }
  }, [isVisible]);

  if (!isVisible) {
    return null;
  }

  const handleAllow = async () => {
    setIsProcessing(true);

    try {
      const success = await subscribeToPushNotifications();

      if (success) {
        consentLogger.info('User allowed notifications');
        onDecision?.('allowed');
      } else {
        consentLogger.info('User denied notifications or subscription failed');
        onDecision?.('denied');
      }
    } catch (error) {
      consentLogger.error('Error during notification subscription', error);
      onDecision?.('denied');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDeny = () => {
    consentLogger.info('User explicitly denied notifications');
    setNotificationConsent('denied');
    onDecision?.('denied');
  };

  const handleMaybeLater = () => {
    consentLogger.info('User dismissed notification prompt (maybe later)');
    dismissPrompt();
    onDecision?.('later');
  };

  return (
    <div
      className="fixed bottom-20 right-4 z-40 max-w-sm bg-black/90 backdrop-blur-sm rounded-xl p-5 shadow-2xl text-white"
      role="dialog"
      aria-label="Notification permission"
      data-testid="notification-prompt"
    >
      <div className="mb-4">
        <h3 className="text-base font-semibold mb-2">
          <Trans>🔔 Stay in the game</Trans>
        </h3>
        <p className="text-sm leading-relaxed opacity-90">
          <Trans>Get tournament reminders and streak alerts. Allow notifications?</Trans>
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <button
          type="button"
          onClick={handleAllow}
          disabled={isProcessing}
          data-testid="notification-prompt-allow"
          className="px-4 py-2.5 rounded-lg border-none bg-blue-500 text-white text-sm font-semibold hover:bg-blue-600 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {isProcessing ? t`Processing...` : t`Allow`}
        </button>

        <button
          type="button"
          onClick={handleDeny}
          disabled={isProcessing}
          data-testid="notification-prompt-deny"
          className="px-4 py-2.5 rounded-lg border border-white/20 bg-transparent text-white text-sm font-medium hover:bg-white/10 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
        >
          <Trans>No thanks</Trans>
        </button>

        <button
          type="button"
          onClick={handleMaybeLater}
          disabled={isProcessing}
          data-testid="notification-prompt-later"
          className="px-4 py-2 rounded border-none bg-transparent text-white/60 text-xs underline hover:text-white/80 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
        >
          <Trans>Maybe later</Trans>
        </button>
      </div>
    </div>
  );
}

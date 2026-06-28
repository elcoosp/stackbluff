import { useState, useEffect } from 'react';
import { useConsentStore } from '@/stores/consentStore';
import { isPushSupported, subscribeToPushNotifications } from '@/services/notifications';
import { consentLogger } from '@/lib/logger';

interface NotificationPromptProps {
  /**
   * Callback when the user makes a decision.
   */
  onDecision?: (decision: 'allowed' | 'denied' | 'later') => void;
}

/**
 * Non-intrusive notification permission prompt.
 * Unified visibility: reads directly from consent store.
 */
export function NotificationPrompt({ onDecision }: NotificationPromptProps) {
  const [isProcessing, setIsProcessing] = useState(false);

  const canShowPrompt = useConsentStore((s) => s.canShowNotificationPrompt());
  const notificationConsent = useConsentStore((s) => s.notificationConsent);
  const markPromptShown = useConsentStore((s) => s.setNotificationConsent);
  const dismissPrompt = useConsentStore((s) => s.dismissNotificationPrompt);

  // Unified visibility: only show if store says we can
  const isVisible = canShowPrompt && isPushSupported();

  // Log visibility changes
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
    useConsentStore.getState().setNotificationConsent('denied');
    onDecision?.('denied');
  };

  const handleMaybeLater = () => {
    consentLogger.info('User dismissed notification prompt (maybe later)');
    dismissPrompt(); // Sets cooldown timer (24 hours)
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
          🔔 Stay in the game
        </h3>
        <p className="text-sm leading-relaxed opacity-90">
          Get tournament reminders and streak alerts. Allow notifications?
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
          {isProcessing ? 'Processing...' : 'Allow'}
        </button>

        <button
          type="button"
          onClick={handleDeny}
          disabled={isProcessing}
          data-testid="notification-prompt-deny"
          className="px-4 py-2.5 rounded-lg border border-white/20 bg-transparent text-white text-sm font-medium hover:bg-white/10 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
        >
          No thanks
        </button>

        <button
          type="button"
          onClick={handleMaybeLater}
          disabled={isProcessing}
          data-testid="notification-prompt-later"
          className="px-4 py-2 rounded border-none bg-transparent text-white/60 text-xs underline hover:text-white/80 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
        >
          Maybe later
        </button>
      </div>
    </div>
  );
}

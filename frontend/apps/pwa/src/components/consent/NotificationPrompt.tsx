import { useState } from 'react';
import { useConsentStore } from '@/stores/consentStore';
import {
  isPushSupported,
  subscribeToPushNotifications,
} from '@/services/notificationService';

interface NotificationPromptProps {
  /**
   * Callback when the user makes a decision.
   */
  onDecision?: (decision: 'allowed' | 'denied' | 'later') => void;
}

/**
 * Non-intrusive notification permission prompt.
 * Should be shown after the user's first game hand completion.
 */
export function NotificationPrompt({ onDecision }: NotificationPromptProps) {
  const [isVisible, setIsVisible] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);

  const canShowPrompt = useConsentStore((s) => s.canShowNotificationPrompt());
  const markPromptShown = useConsentStore((s) => s.markNotificationPromptShown);
  const dismissPrompt = useConsentStore((s) => s.dismissNotificationPrompt);

  // Don't show if:
  // - Push is not supported
  // - User has already granted/denied permission
  // - Prompt was recently dismissed ("maybe later")
  if (!isPushSupported() || !canShowPrompt || !isVisible) {
    return null;
  }

  const handleAllow = async () => {
    setIsProcessing(true);

    try {
      const success = await subscribeToPushNotifications();

      if (success) {
        onDecision?.('allowed');
      } else {
        // Permission was denied or failed
        onDecision?.('denied');
      }
    } catch (error) {
      console.error('Error during notification subscription:', error);
      onDecision?.('denied');
    } finally {
      setIsVisible(false);
      setIsProcessing(false);
      markPromptShown();
    }
  };

  const handleDeny = () => {
    useConsentStore.getState().setNotificationConsent('denied');
    setIsVisible(false);
    markPromptShown();
    onDecision?.('denied');
  };

  const handleMaybeLater = () => {
    setIsVisible(false);
    dismissPrompt(); // Sets cooldown timer (24 hours)
    onDecision?.('later');
  };

  return (
    <div
      style={{
        position: 'fixed',
        bottom: '5rem',
        right: '1rem',
        zIndex: 9998,
        maxWidth: '24rem',
        backgroundColor: 'rgba(0, 0, 0, 0.9)',
        backdropFilter: 'blur(8px)',
        borderRadius: '0.75rem',
        padding: '1.25rem',
        boxShadow: '0 10px 25px rgba(0, 0, 0, 0.3)',
        color: '#fff',
        fontFamily: 'system-ui, -apple-system, sans-serif',
      }}
      role="dialog"
      aria-label="Notification permission"
      data-testid="notification-prompt"
    >
      <div style={{ marginBottom: '1rem' }}>
        <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1rem', fontWeight: 600 }}>
          🔔 Stay in the game
        </h3>
        <p style={{ margin: 0, fontSize: '0.875rem', lineHeight: 1.5, opacity: 0.9 }}>
          Get tournament reminders and streak alerts. Allow notifications?
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        <button
          type="button"
          onClick={handleAllow}
          disabled={isProcessing}
          data-testid="notification-prompt-allow"
          style={{
            padding: '0.625rem 1rem',
            borderRadius: '0.5rem',
            border: 'none',
            backgroundColor: '#3b82f6',
            color: '#fff',
            cursor: isProcessing ? 'not-allowed' : 'pointer',
            fontSize: '0.875rem',
            fontWeight: 600,
            opacity: isProcessing ? 0.6 : 1,
          }}
        >
          {isProcessing ? 'Processing...' : 'Allow'}
        </button>

        <button
          type="button"
          onClick={handleDeny}
          disabled={isProcessing}
          data-testid="notification-prompt-deny"
          style={{
            padding: '0.625rem 1rem',
            borderRadius: '0.5rem',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            backgroundColor: 'transparent',
            color: '#fff',
            cursor: isProcessing ? 'not-allowed' : 'pointer',
            fontSize: '0.875rem',
            fontWeight: 500,
            opacity: isProcessing ? 0.6 : 1,
          }}
        >
          No thanks
        </button>

        <button
          type="button"
          onClick={handleMaybeLater}
          disabled={isProcessing}
          data-testid="notification-prompt-later"
          style={{
            padding: '0.5rem',
            borderRadius: '0.375rem',
            border: 'none',
            backgroundColor: 'transparent',
            color: 'rgba(255, 255, 255, 0.6)',
            cursor: isProcessing ? 'not-allowed' : 'pointer',
            fontSize: '0.75rem',
            textDecoration: 'underline',
            opacity: isProcessing ? 0.6 : 1,
          }}
        >
          Maybe later
        </button>
      </div>
    </div>
  );
}

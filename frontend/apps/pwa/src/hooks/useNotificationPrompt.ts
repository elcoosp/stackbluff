import { useEffect, useState } from 'react';
import { useConsentStore } from '@/stores/consentStore';
import { isPushSupported } from '@/services/notificationService';

/**
 * Hook to determine when to show the notification permission prompt.
 *
 * The prompt should appear after the user's first game hand completes.
 * This hook tracks whether the user has played their first hand and
 * whether the prompt should be shown.
 */
export function useNotificationPrompt() {
  const [shouldShowPrompt, setShouldShowPrompt] = useState(false);

  const canShowPrompt = useConsentStore((s) => s.canShowNotificationPrompt());
  const notificationPromptShown = useConsentStore((s) => s.notificationPromptShown);

  useEffect(() => {
    // Only show if:
    // 1. Push is supported
    // 2. User hasn't been shown the prompt yet (or cooldown has passed)
    // 3. User can show the prompt (hasn't granted/denied)
    if (isPushSupported() && canShowPrompt && !notificationPromptShown) {
      setShouldShowPrompt(true);
    } else {
      setShouldShowPrompt(false);
    }
  }, [canShowPrompt, notificationPromptShown]);

  /**
   * Call this when the user completes their first game hand.
   * This will trigger the notification prompt to appear.
   */
  const markFirstHandComplete = () => {
    // Check if this is the first hand by looking at localStorage
    const hasPlayedBefore = localStorage.getItem('has_played_first_hand');

    if (!hasPlayedBefore) {
      localStorage.setItem('has_played_first_hand', 'true');
      // The prompt will show on next render if conditions are met
      setShouldShowPrompt(true);
    }
  };

  return {
    shouldShowPrompt,
    markFirstHandComplete,
  };
}

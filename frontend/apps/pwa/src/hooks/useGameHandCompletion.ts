import { useEffect } from 'react';
import { useNotificationPrompt } from './useNotificationPrompt';

/**
 * Hook to listen for game hand completion events and trigger
 * the notification permission prompt after the first hand.
 *
 * This should be used in the game/table page component.
 */
export function useGameHandCompletion() {
  const { markFirstHandComplete } = useNotificationPrompt();

  useEffect(() => {
    /**
     * Listen for custom 'handCompleted' events.
     * The game engine or WebSocket handler should dispatch this event
     * when a hand completes.
     */
    const handleHandCompleted = () => {
      console.log('[useGameHandCompletion] Hand completed, checking notification prompt');
      markFirstHandComplete();
    };

    // Listen for the custom event
    window.addEventListener('handCompleted', handleHandCompleted);

    // Also listen for WebSocket messages if they're dispatched as custom events
    // The WS handler should dispatch 'ws:HandResult' or similar
    const handleWSMessage = (event: CustomEvent) => {
      if (event.detail?.type === 'HandResult' || event.detail?.type === 'hand_result') {
        console.log('[useGameHandCompletion] HandResult received via WS');
        markFirstHandComplete();
      }
    };

    window.addEventListener('ws:message' as any, handleWSMessage as any);

    return () => {
      window.removeEventListener('handCompleted', handleHandCompleted);
      window.removeEventListener('ws:message' as any, handleWSMessage as any);
    };
  }, [markFirstHandComplete]);
}

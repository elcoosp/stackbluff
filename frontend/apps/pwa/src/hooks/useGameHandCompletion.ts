import { useEffect, useRef } from 'react';
import { useActiveRoom } from '@stackbluff/shared/stores/gameStore';
import { useConsentStore } from '@/stores/consentStore';
import { FIRST_HAND_PLAYED_KEY } from '@/lib/consent/constants';
import { consentLogger } from '@/lib/logger';

const logger = consentLogger.child({ component: 'useGameHandCompletion' });

/**
 * Hook to detect when a user completes their first game hand.
 * Co-located with TablePage since it's only used there.
 *
 * Monitors the game state via showdownReveal transitions:
 * - showdownReveal goes from non-null → null (hand ended)
 * - AND handInProgress goes from true → false (hand fully complete)
 *
 * This properly tracks the object lifecycle rather than boolean comparison.
 */
export function useGameHandCompletion() {
  const activeRoom = useActiveRoom();
  const notificationConsent = useConsentStore((s) => s.notificationConsent);

  // Track previous state using refs
  const prevShowdownRef = useRef<unknown>(undefined);
  const prevHandInProgressRef = useRef<boolean | undefined>(undefined);
  const prevRoomIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!activeRoom) {
      return;
    }

    const currentRoomId = (activeRoom && typeof activeRoom === "object" && "roomId" in activeRoom) ? activeRoom.roomId : (activeRoom && typeof activeRoom === "object" && "id" in activeRoom ? activeRoom.id : "unknown");
    const currentShowdown = activeRoom.showdownReveal;
    const currentHandInProgress = activeRoom.handInProgress;

    // Reset tracking when room changes
    if (prevRoomIdRef.current !== currentRoomId) {
      logger.debug('Room changed, resetting hand tracking', { roomId: currentRoomId });
      prevShowdownRef.current = currentShowdown;
      prevHandInProgressRef.current = currentHandInProgress;
      prevRoomIdRef.current = currentRoomId;
      return;
    }

    // Detect hand completion:
    // - showdownReveal was non-null (showdown happened) and is now null (cleared)
    // - OR handInProgress was true and is now false
    const showdownCleared =
      prevShowdownRef.current != null &&
      currentShowdown == null;

    const handEnded =
      prevHandInProgressRef.current === true &&
      currentHandInProgress === false;

    const handJustCompleted = showdownCleared || handEnded;

    if (handJustCompleted) {
      logger.info('Hand completion detected', {
        showdownCleared,
        handEnded,
        roomId: currentRoomId,
      });
      markFirstHandComplete();
    }

    // Update refs for next comparison
    prevShowdownRef.current = currentShowdown;
    prevHandInProgressRef.current = currentHandInProgress;
  }, [activeRoom, notificationConsent]);
}

/**
 * Mark that the user has played their first hand.
 * This enables the notification prompt to show.
 */
function markFirstHandComplete(): void {
  const hasPlayedBefore = localStorage.getItem(FIRST_HAND_PLAYED_KEY);

  if (!hasPlayedBefore) {
    logger.info('Marking first hand as complete');
    localStorage.setItem(FIRST_HAND_PLAYED_KEY, 'true');
  }
}

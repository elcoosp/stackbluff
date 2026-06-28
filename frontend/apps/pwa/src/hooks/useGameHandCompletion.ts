import { useEffect, useRef } from 'react';
import { useActiveRoom } from '@stackbluff/shared/stores/gameStore';
import { useConsentStore } from '@/stores/consentStore';
import { FIRST_HAND_PLAYED_KEY } from '@/lib/consent/constants';
import { consentLogger } from '@/lib/logger';

const logger = consentLogger.child({ component: 'useGameHandCompletion' });

/**
 * Hook to detect when a user completes their first game hand.
 *
 * This monitors the game state and triggers the notification prompt
 * after the first hand completes. Uses the actual game store state
 * to detect hand completion (showdown phase ending).
 */
export function useGameHandCompletion() {
  const activeRoom = useActiveRoom();
  const notificationConsent = useConsentStore((s) => s.notificationConsent);

  const prevShowdownRef = useRef<boolean | undefined>(undefined);
  const prevRoomIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!activeRoom) {
      return;
    }

    const currentRoomId = activeRoom.id;
    const currentShowdown = activeRoom.showdownReveal;

    // Reset tracking when room changes
    if (prevRoomIdRef.current !== currentRoomId) {
      logger.debug('Room changed, resetting hand tracking', { roomId: currentRoomId });
      prevShowdownRef.current = currentShowdown;
      prevRoomIdRef.current = currentRoomId;
      return;
    }

    // Detect hand completion: showdown was true, now it's false/undefined
    const handJustCompleted =
      prevShowdownRef.current === true &&
      (currentShowdown === false || currentShowdown === undefined);

    if (handJustCompleted) {
      logger.info('Hand completion detected');
      markFirstHandComplete();
    }

    prevShowdownRef.current = currentShowdown;
  }, [activeRoom, notificationConsent]);
}

/**
 * Mark that the user has played their first hand.
 * This enables the notification prompt to show.
 */
function markFirstHandComplete(): void {
  // Check if this is the first hand by looking at localStorage
  const hasPlayedBefore = localStorage.getItem(FIRST_HAND_PLAYED_KEY);

  if (!hasPlayedBefore) {
    logger.info('Marking first hand as complete');
    localStorage.setItem(FIRST_HAND_PLAYED_KEY, 'true');
    // The prompt will show on next render if conditions are met
  }
}

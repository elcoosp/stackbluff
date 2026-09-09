import { useActiveRoom } from '@stackbluff/shared/stores/gameStore';
import { useEffect, useRef } from 'react';
import { FIRST_HAND_PLAYED_KEY } from '@/lib/consent/constants';
import { consentLogger } from '@/lib/logger';
import { useConsentStore } from '@/stores/consentStore';

const logger = consentLogger.child({ component: 'useGameHandCompletion' });

export function useGameHandCompletion() {
  const activeRoom = useActiveRoom();
  const _notificationConsent = useConsentStore((s) => s.notificationConsent);

  const prevShowdownRef = useRef<unknown>(undefined);
  const prevHandInProgressRef = useRef<boolean | undefined>(undefined);
  const prevRoomIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!activeRoom) return;

    const currentRoomId = (activeRoom as any)?.roomId || (activeRoom as any)?.id || 'unknown';
    const currentShowdown = (activeRoom as any)?.showdownReveal;
    const currentHandInProgress = (activeRoom as any)?.handInProgress;

    if (prevRoomIdRef.current !== currentRoomId) {
      logger.debug('Room changed, resetting hand tracking', { roomId: currentRoomId });
      prevShowdownRef.current = currentShowdown;
      prevHandInProgressRef.current = currentHandInProgress;
      prevRoomIdRef.current = currentRoomId;
      return;
    }

    const showdownCleared = prevShowdownRef.current != null && currentShowdown == null;
    const handEnded = prevHandInProgressRef.current === true && currentHandInProgress === false;
    const handJustCompleted = showdownCleared || handEnded;

    if (handJustCompleted) {
      logger.info('Hand completion detected', {
        showdownCleared,
        handEnded,
        roomId: currentRoomId,
      });
      markFirstHandComplete();
    }

    prevShowdownRef.current = currentShowdown;
    prevHandInProgressRef.current = currentHandInProgress;
  }, [activeRoom]);
}

function markFirstHandComplete(): void {
  const hasPlayedBefore = localStorage.getItem(FIRST_HAND_PLAYED_KEY);
  if (!hasPlayedBefore) {
    logger.info('Marking first hand as complete');
    localStorage.setItem(FIRST_HAND_PLAYED_KEY, 'true');
  }
}

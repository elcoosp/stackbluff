/**
 * SeatGrid — native port of PWA `components/game/SeatGrid.tsx`.
 *
 * Maps occupied seats to the frozen 9-max anchors with hero rotation
 * (ui-native getPositionIndex / getTablePositions), positions each spot via
 * `positionToStyle` (percentage translate, RN ≥ 0.76), tracks the last
 * dealer seat for the button placement, and routes the hero/opponent
 * countdown shared values to the acting seat only.
 */

import type { Seat } from '@stackbluff/shared/src/stores/gameStore';
import { getPositionIndex, getTablePositions, positionToStyle } from '@stackbluff/ui-native';
import { memo, useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';
import type { SharedValue } from 'react-native-reanimated';
import { PlayerSpot } from './PlayerSpot';

export interface SeatGridProps {
  seats: Record<number, Seat>;
  heroSeat: number | null;
  isDesktop: boolean;
  containerWidth: number;
  /** Countdown for the hero's own turn (null when not acting). */
  heroTimerProgress?: SharedValue<number> | null;
  /** Countdown for the current opponent turn (null when none). */
  opponentTimerProgress?: SharedValue<number> | null;
  opponentTurnUserId?: string | null;
  isDealing: boolean;
  onShowStats?: (userId: string) => void;
  onKick?: (userId: string) => void;
}

export const SeatGrid = memo(function SeatGrid({
  seats,
  heroSeat,
  isDesktop,
  containerWidth,
  heroTimerProgress,
  opponentTimerProgress,
  opponentTurnUserId,
  isDealing,
  onShowStats,
  onKick,
}: SeatGridProps) {
  const positions = useMemo(() => getTablePositions(!isDesktop), [isDesktop]);

  const currentDealerSeat = useMemo(() => {
    for (const [index, seat] of Object.entries(seats)) {
      if (seat.position_badge === 'BTN') return Number(index);
    }
    return null;
  }, [seats]);

  const [lastDealerSeat, setLastDealerSeat] = useState<number | null>(null);
  useEffect(() => {
    if (currentDealerSeat !== null) setLastDealerSeat(currentDealerSeat);
  }, [currentDealerSeat]);

  return (
    <>
      {Object.entries(seats).map(([index, seat]) => {
        const seatIndex = Number(index);
        const posIndex = heroSeat !== null ? getPositionIndex(seatIndex, heroSeat) : seatIndex;
        const pos = positions[posIndex];
        if (!pos) return null;

        const isHero = seatIndex === heroSeat;
        const isDealer = seatIndex === lastDealerSeat;

        const showTimer =
          (isHero && heroTimerProgress) ||
          (!!opponentTurnUserId && seat.user_id === opponentTurnUserId && opponentTimerProgress);

        return (
          <View
            key={index}
            pointerEvents="box-none"
            style={[
              positionToStyle(pos),
              {
                zIndex: isHero ? 445 : 440,
                // Seat wrappers never clip the card/badge overflows.
                overflow: 'visible',
              },
            ]}
          >
            <PlayerSpot
              seat={seat}
              isHero={isHero}
              isMobile={!isDesktop}
              isDealer={isDealer}
              seatPosition={pos}
              containerWidth={containerWidth}
              timerProgress={
                showTimer ? (isHero ? heroTimerProgress : opponentTimerProgress) : null
              }
              isDealing={isDealing}
              onShowStats={onShowStats}
              onKick={onKick}
            />
          </View>
        );
      })}
    </>
  );
});

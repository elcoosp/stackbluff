import { useState, useEffect } from 'react';
import { LayoutGroup } from 'framer-motion';
import { PlayerSpot } from './PlayerSpot';
import {
  desktopPositions,
  getMobilePositions,
  MAX_SEATS,
} from '@/lib/seatPositions';
import { cn } from '@/lib/utils';

const seatTransition = 'left 0.4s ease, top 0.4s ease, transform 0.4s ease';

export const SeatGrid = ({
  seats,
  heroSeat,
  isDesktop,
  currentTurnUserId,
  heroTimerRemainingMs,
  heroTimerTotalMs,
  opponentTurnUserId,
  opponentTimerRemainingMs,
  opponentTimerTotalMs,
  isDealing,
  onShowStats,
}: {
  seats: Record<number, any>;
  heroSeat: number;
  isDesktop: boolean;
  currentTurnUserId?: string | null;
  heroTimerRemainingMs?: number | null;
  heroTimerTotalMs?: number | null;
  opponentTurnUserId?: string | null;
  opponentTimerRemainingMs?: number | null;
  opponentTimerTotalMs?: number | null;
  isDealing?: boolean;
  onShowStats?: (userId: string) => void;
}) => {
  const vw = useState(typeof window !== 'undefined' ? window.innerWidth : 500)[0];
  const isNarrowMobile = !isDesktop && vw < 362;

  const positions = isDesktop ? desktopPositions : getMobilePositions(isNarrowMobile);

  let currentDealerSeat: number | null = null;
  for (const [index, seat] of Object.entries(seats)) {
    if (seat.position_badge === 'BTN') {
      currentDealerSeat = Number(index);
      break;
    }
  }

  const [lastDealerSeat, setLastDealerSeat] = useState<number | null>(null);

  useEffect(() => {
    if (currentDealerSeat !== null) {
      setLastDealerSeat(currentDealerSeat);
    }
  }, [currentDealerSeat]);

  return (
    <LayoutGroup>
      {Object.entries(seats).map(([index, seat]) => {
        const seatIndex = Number(index);
        const posIndex =
          heroSeat !== null
            ? ((seatIndex - heroSeat) % MAX_SEATS + MAX_SEATS) % MAX_SEATS
            : seatIndex;
        const pos = positions[posIndex];
        if (!pos) return null;

        const isDealer = seatIndex === lastDealerSeat;
        const isHero = seatIndex === heroSeat;

        let timerRemainingMs: number | null = null;
        let timerTotalMs: number | null = null;
        if (isHero) {
          timerRemainingMs = heroTimerRemainingMs ?? null;
          timerTotalMs = heroTimerTotalMs ?? null;
        } else if (opponentTurnUserId && seat.user_id === opponentTurnUserId) {
          timerRemainingMs = opponentTimerRemainingMs ?? null;
          timerTotalMs = opponentTimerTotalMs ?? null;
        }

        const seatWithName = {
          ...seat,
          display_name: seat.display_name || seat.user_id?.slice(0, 8) || 'Player',
          position_badge: seat.position_badge || undefined,
        };

        return (
          <div
            key={index}
            // Hero wrapper gets z-[445] to sit above opponents (440) and focus mask (441), but below PotBadge (450)
            className={cn("absolute overflow-visible", isHero ? "z-[445]" : "z-[440]")}
            style={{
              left: pos.left,
              top: pos.top,
              transform: pos.transform,
              transition: seatTransition,
            }}
          >
            <PlayerSpot
              seat={seatWithName}
              isHero={isHero}
              isMobile={!isDesktop}
              isDealer={isDealer}
              seatPosition={pos}
              timerRemainingMs={timerRemainingMs}
              timerTotalMs={timerTotalMs}
              isDealing={isDealing}
              onShowStats={onShowStats}
            />
          </div>
        );
      })}
    </LayoutGroup>
  );
};

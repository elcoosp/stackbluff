import { LayoutGroup } from 'framer-motion';
import { useEffect, useMemo, useState } from 'react';
import { desktopPositions, getMobilePositions, MAX_SEATS } from '@/lib/seatPositions';
import { cn } from '@/lib/utils';
import { PlayerSpot } from './PlayerSpot';

const seatTransition = 'left 0.4s ease, top 0.4s ease, bottom 0.4s ease, transform 0.4s ease';

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
  onKick,
}: any) => {
  const [vw, setVw] = useState(typeof window !== 'undefined' ? window.innerWidth : 500);

  useEffect(() => {
    const onResize = () => setVw(window.innerWidth);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const isNarrowMobile = !isDesktop && vw < 390;

  const positions = useMemo(
    () => (isDesktop ? desktopPositions : getMobilePositions(isNarrowMobile)),
    [isDesktop, isNarrowMobile],
  );

  let currentDealerSeat: number | null = null;
  for (const [index, seat] of Object.entries(seats)) {
    if ((seat as any).position_badge === 'BTN') {
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
      {Object.entries(seats).map(([index, seat]: [string, any]) => {
        const seatIndex = Number(index);
        const posIndex =
          heroSeat !== null
            ? (((seatIndex - heroSeat) % MAX_SEATS) + MAX_SEATS) % MAX_SEATS
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

        return (
          <div
            key={index}
            className={cn('absolute overflow-visible', isHero ? 'z-[445]' : 'z-[440]')}
            style={{
              left: pos.left,
              top: pos.top,
              bottom: pos.bottom, // Added bottom support
              transform: pos.transform,
              transition: seatTransition,
            }}
          >
            <PlayerSpot
              seat={seat}
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

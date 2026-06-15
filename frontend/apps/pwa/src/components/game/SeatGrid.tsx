import { Seat } from '@stackbluff/shared/stores/gameStore';
import { PlayerSpot } from './PlayerSpot';

type Position = { top?: string; left?: string; right?: string; bottom?: string; transform: string };

const desktopPositions: Record<number, Position> = {
  1: { top: '10%', left: '15%', transform: 'translate(-50%, -50%)' },
  2: { top: '50%', left: '2%', transform: 'translate(-50%, -50%)' },
  3: { bottom: '10%', left: '20%', transform: 'translate(-50%, 50%)' },
  4: { top: '10%', right: '15%', transform: 'translate(50%, -50%)' },
  5: { top: '40%', right: '2%', transform: 'translate(50%, -50%)' },
  6: { top: '82%', right: '5%', transform: 'translate(50%, -50%)' },
  7: { bottom: '-45px', left: '50%', transform: 'translateX(-50%)' },
};

const mobilePositions: Record<number, Position> = {
  1: { top: '5%', left: '50%', transform: 'translateX(-50%)' },
  2: { top: '35%', left: '5%', transform: 'translateX(0)' },
  3: { top: '65%', left: '5%', transform: 'translateX(0)' },
  4: { top: '35%', right: '5%', transform: 'translateX(0)' },
  5: { top: '65%', right: '5%', transform: 'translateX(0)' },
  6: { top: '90%', right: '5%', transform: 'translateX(0)' },
  7: { bottom: '20px', left: '50%', transform: 'translateX(-50%)' },
};

export const SeatGrid = ({ seats, heroSeat, isDesktop }: { seats: Record<number, any>; heroSeat: number | null; isDesktop: boolean }) => {
  const positions = isDesktop ? desktopPositions : mobilePositions;
  return (
    <>
      {Object.entries(seats).map(([index, seat]: [string, any]) => {
        const pos = positions[Number(index)];
        if (!pos) return null;
        return (
          <div key={index} className="absolute" style={pos}>
            <PlayerSpot seat={seat} isHero={Number(index) === heroSeat} />
          </div>
        );
      })}
    </>
  );
};
